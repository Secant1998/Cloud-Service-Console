"""Private cloud catalog and lossless, on-demand browser viewing manifests."""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import sqlite3
import threading
import xml.etree.ElementTree as ET

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse


def safe_relative(value: str) -> str:
    value = str(value).replace('\\', '/')
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or ':' in value or '\x00' in value:
        raise ValueError('Invalid model resource path')
    return path.as_posix()


def source_key(row):
    source = row.get('source', '').lower()
    if 'libero' in source:
        return 'libero'
    if 'partnet' in source:
        return 'partnet'
    if 'google scanned' in source:
        return 'gso'
    if 'robocasa' in source:
        return 'robocasa'
    return 'robosuite'


def numbers(value, default):
    result = list(map(float, str(value).split())) if value else list(default)
    if len(result) != len(default) or not all(math.isfinite(x) for x in result):
        raise ValueError('Invalid model transform')
    return result


def urdf_controls(xml):
    """Expose native joint coordinates without inventing missing motion limits."""
    result = []
    names = set()
    for element in xml.findall('joint'):
        name, kind = element.get('name'), element.get('type', '')
        if not name or name in names:
            raise ValueError('Invalid or duplicate URDF joint name')
        names.add(name)
        if kind == 'fixed':
            continue
        child, parent = element.find('child'), element.find('parent')
        if child is None or parent is None:
            raise ValueError('URDF joint is missing a link')
        item = {'name': name, 'type': kind, 'parent': parent.get('link'),
                'child': child.get('link'), 'axis': [1, 0, 0], 'lower': None, 'upper': None}
        try:
            if kind not in {'revolute', 'continuous', 'prismatic'}:
                raise ValueError('暂不支持此关节类型：' + kind)
            axis = element.find('axis')
            try:
                vector = numbers(axis.get('xyz') if axis is not None else None, [1, 0, 0])
            except ValueError as exc:
                raise ValueError('源模型的关节轴数据无效') from exc
            length = math.hypot(*vector)
            if length < 1e-12:
                raise ValueError('关节轴无效')
            item['axis'] = [value / length for value in vector]
            if kind != 'continuous':
                limit = element.find('limit')
                if limit is None or any(limit.get(key) is None for key in ('lower', 'upper')):
                    raise ValueError('源模型未提供完整的关节范围')
                try:
                    lower, upper = float(limit.get('lower')), float(limit.get('upper'))
                except ValueError as exc:
                    raise ValueError('源模型的关节范围无效') from exc
                if not math.isfinite(lower) or not math.isfinite(upper) or lower > upper:
                    raise ValueError('源模型的关节范围无效')
                item.update(lower=lower, upper=upper)
                if lower == upper:
                    raise ValueError('关节范围为零')
            mimic = element.find('mimic')
            if mimic is not None:
                multiplier, offset = float(mimic.get('multiplier', '1')), float(mimic.get('offset', '0'))
                if not math.isfinite(multiplier) or not math.isfinite(offset):
                    raise ValueError('关节联动参数无效')
                item['mimic'] = {'joint': mimic.get('joint', ''), 'multiplier': multiplier, 'offset': offset}
        except ValueError as exc:
            item['disabled_reason'] = str(exc)
        result.append(item)
    by_name = {item['name']: item for item in result}
    for item in result:
        current, seen = item, {item['name']}
        while current.get('mimic'):
            target = current['mimic']['joint']
            if target in seen or target not in by_name:
                item['disabled_reason'] = '关节联动引用缺失或循环'
                break
            seen.add(target)
            current = by_name[target]
            if current.get('disabled_reason'):
                item['disabled_reason'] = '联动关节不可操作：' + target
                break
    return result


def category_key(value):
    return (value or '').strip().casefold()


def source_category(row):
    return row.get('category') or next(iter(row.get('tags') or []), '')


def resolve_category_overrides(entries, path):
    """Apply reviewed model assignments; new types require explicit declarations."""
    document = json.loads(Path(path).read_text(encoding='utf-8'))
    if (not isinstance(document, dict) or document.get('version') != 1
            or not isinstance(document.get('groups'), list)):
        raise ValueError('Invalid category override document')
    added = document.get('new_categories', [])
    if (not isinstance(added, list)
            or any(not isinstance(value, str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,119}', value)
                   for value in added)
            or len(set(added)) != len(added)):
        raise ValueError('Invalid declared categories')
    by_id = {row['id']: row for row in entries}
    existing = {category_key(source_category(row)) for row in entries} | set(added)
    resolved, skipped, seen = {}, [], set()
    for group in document['groups']:
        if (not isinstance(group, dict)
                or any(not isinstance(group.get(key), str) or not group[key].strip()
                       for key in ('from', 'to', 'reason'))
                or not isinstance(group.get('ids'), list) or not group['ids']):
            raise ValueError('Invalid category override group')
        before, after = category_key(group['from']), category_key(group['to'])
        if before == after:
            raise ValueError('Category override must change category')
        for asset_id in group['ids']:
            if not isinstance(asset_id, str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,95}', asset_id):
                raise ValueError('Invalid category override identifier')
            if asset_id in seen:
                raise ValueError('Duplicate category override: ' + asset_id)
            seen.add(asset_id)
            row = by_id.get(asset_id)
            reason = ('model_missing' if row is None else
                      'source_changed' if category_key(source_category(row)) != before else
                      'target_missing' if after not in existing else '')
            if reason:
                skipped.append({'id': asset_id, 'reason': reason})
            else:
                resolved[asset_id] = after
    return resolved, skipped


def resolve_classification_details(entries, path, overrides):
    document = json.loads(Path(path).read_text(encoding='utf-8'))
    details = document.get('details', {})
    if not isinstance(details, dict):
        raise ValueError('Invalid classification details')
    by_id = {row['id']: row for row in entries}
    resolved, skipped = {}, []
    for asset_id, detail in details.items():
        if (not isinstance(asset_id, str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,95}', asset_id)
                or not isinstance(detail, dict)
                or any(not isinstance(detail.get(key), str) or not detail[key].strip()
                       for key in ('from', 'category', 'subcategory', 'note'))
                or detail.get('status') not in {'reviewed', 'needs_review'}
                or not isinstance(detail.get('attributes'), dict)
                or any(key not in {'brand', 'color', 'pattern', 'material'}
                       or not isinstance(value, str) or not value.strip()
                       for key, value in detail['attributes'].items())):
            raise ValueError('Invalid classification detail: ' + str(asset_id))
        entry = by_id.get(asset_id)
        reason = ('model_missing' if entry is None else
                  'source_changed' if category_key(source_category(entry)) != category_key(detail['from']) else
                  'category_changed' if category_key(overrides.get(asset_id, source_category(entry))) !=
                  category_key(detail['category']) else '')
        if reason:
            skipped.append({'id': asset_id, 'reason': reason})
        else:
            resolved[asset_id] = {key: detail[key] for key in ('subcategory', 'attributes', 'status', 'note')}
    return resolved, skipped


def model_search(row, category, classification=None):
    return ' '.join([row['id'], row.get('label', ''), row.get('source', ''),
                     source_category(row), category, *row.get('tags', []),
                     *(([classification['subcategory'], *classification['attributes'].values()])
                       if classification else [])]).lower()


def uses_compiled_texture_uv(row):
    """The v1 RoboCasa exporter writes MuJoCo's V-flipped OBJ coordinates verbatim."""
    return (source_key(row) == 'robocasa' and row.get('normalizer_version') == 1
            and row.get('local_import', {}).get('complete') is True
            and row.get('parameters', {}).get('geometry', {}).get('source') == 'MuJoCo compiled source geometry')


def texture_preview_revision(row):
    if uses_compiled_texture_uv(row) and any(part.get('texture') for part in row.get('visual_parts', [])):
        return 'robocasa-compiled-uv-v1'
    return ''


class ModelLibrary:
    def __init__(self, root: Path, catalog: Path | None = None, category_overrides: Path | None = None):
        self.root = Path(root).resolve()
        self.catalog = Path(catalog).resolve() if catalog else self.root / 'catalog'
        self.database = self.root / 'library.sqlite'
        self.category_overrides = (Path(category_overrides) if category_overrides else
                                   Path(__file__).with_name('model_category_overrides.json'))
        self._thumbnails = None
        self._thumbnail_lock = threading.Lock()

    def connect(self):
        if not self.database.is_file():
            raise FileNotFoundError('模型仓库正在准备，资源校验完成后开放。')
        db = sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True, timeout=15)
        db.row_factory = sqlite3.Row
        db.create_function('category_key', 1, category_key, deterministic=True)
        return db

    def build(self, manifest: Path | None = None):
        entries = json.loads((self.catalog / 'index.json').read_text(encoding='utf-8'))
        overrides, skipped = resolve_category_overrides(entries, self.category_overrides)
        details, details_skipped = resolve_classification_details(entries, self.category_overrides, overrides)
        self.root.mkdir(parents=True, exist_ok=True)
        temporary = self.database.with_suffix('.building.sqlite')
        temporary.unlink(missing_ok=True)
        with closing(sqlite3.connect(temporary)) as db:
            db.executescript('''
                CREATE TABLE files(path TEXT PRIMARY KEY, size INTEGER NOT NULL, sha TEXT NOT NULL);
                CREATE TABLE models(id TEXT PRIMARY KEY, label TEXT, source TEXT, category TEXT,
                    kind TEXT, available INTEGER, directory TEXT, bytes INTEGER, search TEXT, entry TEXT);
                CREATE INDEX sources ON models(source,category);
                CREATE TABLE classifications(id TEXT PRIMARY KEY, detail TEXT NOT NULL);
            ''')
            transfer = self.root / '_transfer/files.sqlite'
            if manifest:
                inventory = json.loads(Path(manifest).read_text(encoding='utf-8'))
                db.executemany('INSERT INTO files VALUES (?,?,?)',
                    ((r['path'], r['bytes'], r['sha256']) for r in inventory['files']))
                del inventory
            elif transfer.is_file():
                db.execute('ATTACH DATABASE ? AS imported', (str(transfer),))
                db.execute('INSERT INTO files SELECT path,size,sha FROM imported.files')
            else:
                for current, _, files in os.walk(self.catalog):
                    for name in files:
                        file = Path(current) / name
                        if file.is_symlink():
                            raise ValueError('Catalog symlinks are not supported')
                        with file.open('rb') as stream:
                            digest = hashlib.sha256()
                            for block in iter(lambda: stream.read(1024 * 1024), b''):
                                digest.update(block)
                        db.execute('INSERT INTO files VALUES (?,?,?)',
                                   (file.relative_to(self.catalog).as_posix(), file.stat().st_size, digest.hexdigest()))
            for row in entries:
                asset_id = row['id']
                if not re.fullmatch(r'[a-z][a-z0-9_-]{0,95}', asset_id):
                    raise ValueError('Invalid asset identifier')
                descriptor = row.get('local_descriptor') or row.get('mesh')
                directory = str(PurePosixPath(safe_relative(descriptor)).parent) if descriptor else ''
                available = bool(descriptor and db.execute('SELECT 1 FROM files WHERE path=?',
                                                           (safe_relative(descriptor),)).fetchone())
                prefix = directory + '/'
                size = db.execute('SELECT COALESCE(SUM(size),0) FROM files WHERE path>=? AND path<?',
                                  (prefix, prefix + '\uffff')).fetchone()[0] if directory else 0
                category = overrides.get(asset_id, source_category(row))
                search = model_search(row, category, details.get(asset_id))
                db.execute('INSERT INTO models VALUES (?,?,?,?,?,?,?,?,?,?)', (
                    asset_id, row.get('label') or asset_id, source_key(row), category,
                    row.get('kind', 'mesh'), available, directory, size, search,
                    json.dumps(row, ensure_ascii=False)))
                if asset_id in details:
                    db.execute('INSERT INTO classifications VALUES (?,?)',
                               (asset_id, json.dumps(details[asset_id], ensure_ascii=False)))
            db.commit()
        os.replace(temporary, self.database)
        return {'models': len(entries), 'database_bytes': self.database.stat().st_size,
                'category_changes': len(overrides), 'category_overrides_skipped': skipped,
                'classification_details': len(details), 'classification_details_skipped': details_skipped}

    def list(self, query='', source='', category='', page=1, page_size=36, exact_category=None):
        where, args = [], []
        for word in query.lower().split()[:12]:
            where.append("search LIKE ? ESCAPE '\\'")
            args.append('%' + word.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%')
        if source:
            where.append('source=?')
            args.append(source)
        selected = [category] if isinstance(category, str) else (category or [])
        if len(selected) > 1000 or any(len(value) > 120 for value in selected):
            raise ValueError('Too many categories or category name too long')
        selected = sorted({category_key(value) for value in selected if category_key(value)})
        category_where, category_args = '', []
        if exact_category is not None:
            category_where, category_args = 'category_key(category)=?', [category_key(exact_category)]
        elif selected:
            category_where = 'category_key(category) IN (' + ','.join('?' for _ in selected) + ')'
            category_args = selected
        if category_where:
            where.append(category_where)
            args.extend(category_args)
        condition = ' WHERE ' + ' AND '.join(where) if where else ''
        with closing(self.connect()) as db:
            total = db.execute('SELECT COUNT(*) FROM models' + condition, args).fetchone()[0]
            rows = db.execute('SELECT id,label,source,category_key(category) AS category,kind,available,bytes FROM models' + condition +
                              ' ORDER BY available DESC,label,id LIMIT ? OFFSET ?',
                              [*args, page_size, (page-1)*page_size]).fetchall()
            sources = [dict(r) for r in db.execute('SELECT source,COUNT(*) AS count FROM models' +
                (' WHERE ' + category_where if category_where else '') + ' GROUP BY source ORDER BY source', category_args)]
            categories = [dict(r) for r in db.execute(
                'SELECT category_key(category) AS category,COUNT(*) AS count FROM models' + (' WHERE source=?' if source else '') +
                ' GROUP BY category_key(models.category) ORDER BY category', [source] if source else [])]
            indexed = db.execute('SELECT COUNT(*) FROM models').fetchone()[0]
            stored = db.execute('SELECT COUNT(*) FROM models WHERE available=1').fetchone()[0]
        return {'items': [dict(r) for r in rows], 'total': total, 'page': page, 'page_size': page_size,
                'sources': sources, 'categories': categories, 'indexed': indexed, 'stored': stored}

    @staticmethod
    def _preview_items(db, category, offset=0, limit=6):
        # Interleave sources so a category's first images are not all one dataset.
        return [dict(row) for row in db.execute('''
            SELECT id,label FROM (
                SELECT id,label,source,ROW_NUMBER() OVER (PARTITION BY source ORDER BY label,id) AS rank
                FROM models WHERE category_key(category)=? AND available=1
            ) ORDER BY rank,source,id LIMIT ? OFFSET ?
        ''', (category_key(category), limit, offset))]

    def category_previews(self, category, offset=0, limit=6):
        with closing(self.connect()) as db:
            total = db.execute('SELECT COUNT(*) FROM models WHERE category_key(category)=? AND available=1',
                               (category_key(category),)).fetchone()[0]
            return {'items': self._preview_items(db, category, offset, limit), 'total': total, 'offset': offset}

    def categories(self, query='', page=1, page_size=36):
        where, args = [], []
        for word in query.casefold().split()[:12]:
            where.append("category_key(category) LIKE ? ESCAPE '\\'")
            args.append('%' + word.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%')
        condition = ' WHERE ' + ' AND '.join(where) if where else ''
        grouped = ' FROM models' + condition + ' GROUP BY category_key(category)'
        with closing(self.connect()) as db:
            total = db.execute('SELECT COUNT(*) FROM (SELECT 1' + grouped + ')', args).fetchone()[0]
            rows = db.execute('SELECT category_key(category) AS category,COUNT(*) AS count,SUM(available) AS stored' +
                              grouped + ' ORDER BY category LIMIT ? OFFSET ?',
                              [*args, page_size, (page - 1) * page_size]).fetchall()
            items = []
            for row in rows:
                item = dict(row)
                item['previews'] = {'items': self._preview_items(db, row['category']),
                                    'total': row['stored'], 'offset': 0}
                items.append(item)
            indexed, stored = db.execute('SELECT COUNT(*),COALESCE(SUM(available),0) FROM models').fetchone()
        return {'items': items, 'total': total, 'page': page, 'page_size': page_size,
                'indexed': indexed, 'stored': stored}

    def get(self, asset_id):
        with closing(self.connect()) as db:
            row = db.execute('SELECT * FROM models WHERE id=?', (asset_id,)).fetchone()
            # Older inventories and rollback backups predate the optional detail table.
            has_details = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='classifications'").fetchone()
            detail = db.execute('SELECT detail FROM classifications WHERE id=?', (asset_id,)).fetchone() if has_details else None
        if row is None:
            raise KeyError('找不到这个模型。')
        result = dict(row)
        result['category'] = category_key(result['category'])
        result.pop('search')
        result['entry'] = json.loads(result['entry'])
        if detail:
            result['classification'] = json.loads(detail['detail'])
        return result

    def thumbnail(self, asset_id):
        with self._thumbnail_lock:
            if self._thumbnails is None:
                from model_thumbnails import ThumbnailCache
                self._thumbnails = ThumbnailCache(self)
            thumbnails = self._thumbnails
        return thumbnails.request(asset_id)

    def file(self, relative):
        relative = safe_relative(relative)
        with closing(self.connect()) as db:
            row = db.execute('SELECT * FROM files WHERE path=?', (relative,)).fetchone()
        if row is None:
            raise FileNotFoundError('模型资源未入库：' + relative)
        file = (self.catalog / relative).resolve()
        if not file.is_relative_to(self.catalog.resolve()) or not file.is_file():
            raise FileNotFoundError('模型资源不存在：' + relative)
        return file, dict(row)

    def asset_file(self, asset_id, relative):
        model = self.get(asset_id)
        relative = safe_relative(relative)
        if not model['directory'] or not relative.startswith(model['directory'] + '/'):
            raise ValueError('Resource does not belong to this model')
        return self.file(relative)

    def manifest(self, asset_id):
        model = self.get(asset_id)
        prefix = model['directory'] + '/'
        with closing(self.connect()) as db:
            files = [dict(r) for r in db.execute('SELECT * FROM files WHERE path>=? AND path<? ORDER BY path',
                                               (prefix, prefix + '\uffff'))] if model['directory'] else []
        return {'id': asset_id, 'entry': model['entry'], 'files': files}

    def view(self, asset_id):
        model = self.get(asset_id)
        if not model['available']:
            raise FileNotFoundError('该模型只有索引，尚无云端文件。')
        row, parts, nodes, warnings, controls = model['entry'], [], [], [], []

        def resource(base, name):
            if '://' in name or name.startswith('package:'):
                raise ValueError('External model resources are not allowed')
            candidate = (self.catalog / base / name).resolve()
            if not candidate.is_relative_to((self.catalog / model['directory']).resolve()):
                raise ValueError('Model reference escapes its directory')
            relative = candidate.relative_to(self.catalog).as_posix()
            self.asset_file(asset_id, relative)
            return relative

        def appearance(part):
            mesh, _ = self.asset_file(asset_id, part['mesh'])
            part['materials'] = []
            if mesh.suffix.lower() != '.obj' or part.get('texture'):
                return part
            mtls = []
            with mesh.open(encoding='utf-8', errors='replace') as stream:
                for line in stream:
                    if line.startswith('mtllib '):
                        mtls.append(line[7:].strip())
            for name in mtls:
                mtl_path = resource(mesh.parent.relative_to(self.catalog), name)
                file, _ = self.file(mtl_path)
                textures = {}
                for line in file.read_text(encoding='utf-8', errors='replace').splitlines():
                    tokens = shlex.split(line, comments=True, posix=True)
                    if tokens and (tokens[0].lower().startswith('map_') or tokens[0].lower() in {'bump', 'norm'}):
                        if len(tokens) > 1:
                            name = tokens[-1]
                            textures[name] = resource(file.parent.relative_to(self.catalog), name)
                part['materials'].append({'file': mtl_path, 'textures': textures})
            return part

        if row.get('descriptor_format') == 'urdf':
            descriptor, _ = self.file(row['local_descriptor'])
            xml = ET.parse(descriptor).getroot()
            links = {link.get('name'): link for link in xml.findall('link')}
            if len(links) != len(xml.findall('link')) or None in links:
                raise ValueError('Invalid or duplicate URDF link name')
            controls = urdf_controls(xml)
            joints = {}
            for joint in xml.findall('joint'):
                child, parent = joint.find('child'), joint.find('parent')
                if child is None or parent is None:
                    raise ValueError('URDF joint is missing a link')
                if child.get('link') in joints or child.get('link') not in links:
                    raise ValueError('Invalid URDF child link')
                origin = joint.find('origin')
                joints[child.get('link')] = {'parent': parent.get('link'),
                    'xyz': numbers(origin.get('xyz') if origin is not None else None, [0,0,0]),
                    'rpy': numbers(origin.get('rpy') if origin is not None else None, [0,0,0])}
            for name, link in links.items():
                node = {'name': name, **joints.get(name, {'parent': None, 'xyz': [0,0,0], 'rpy': [0,0,0]})}
                inertial = link.find('inertial')
                if inertial is not None:
                    origin, mass = inertial.find('origin'), inertial.find('mass')
                    try:
                        center = numbers(origin.get('xyz') if origin is not None else None, [0, 0, 0])
                        weight = float(mass.get('value')) if mass is not None else 0
                        if math.isfinite(weight) and weight > 0:
                            node.update(center_of_mass=center, mass=weight)
                    except (ValueError, TypeError):
                        pass  # Missing/invalid inertia falls back to visual bounds in the viewer.
                nodes.append(node)
                for visual in link.findall('visual'):
                    mesh = visual.find('geometry/mesh')
                    if mesh is None:
                        warnings.append('Unsupported non-mesh URDF visual in ' + name)
                        continue
                    origin = visual.find('origin')
                    color = visual.find('material/color')
                    part = {'node': name, 'mesh': resource(descriptor.parent.relative_to(self.catalog), mesh.get('filename', '')),
                            'xyz': numbers(origin.get('xyz') if origin is not None else None, [0,0,0]),
                            'rpy': numbers(origin.get('rpy') if origin is not None else None, [0,0,0]),
                            'scale': numbers(mesh.get('scale'), [1,1,1])}
                    if color is not None:
                        part['rgba'] = numbers(color.get('rgba'), [1,1,1,1])
                    texture = visual.find('material/texture')
                    if texture is not None:
                        part['texture'] = resource(descriptor.parent.relative_to(self.catalog), texture.get('filename',''))
                    parts.append(appearance(part))
            parents = {node['name']: node['parent'] for node in nodes}
            for name in parents:
                visited = set()
                while name is not None:
                    if name in visited or name not in parents:
                        raise ValueError('Invalid URDF link graph')
                    visited.add(name)
                    name = parents[name]
        else:
            for visual in row.get('visual_parts') or [{'mesh': row['mesh'], 'texture': row.get('texture')}]:
                part = {key: visual[key] for key in ('mesh', 'texture', 'rgba') if visual.get(key) is not None}
                part['mesh'] = safe_relative(part['mesh'])
                if part.get('texture'):
                    part['texture'] = safe_relative(part['texture'])
                    self.asset_file(asset_id, part['texture'])
                    if uses_compiled_texture_uv(row):
                        part['texture_flip_y'] = False
                parts.append(appearance(part))
        if not parts:
            raise ValueError('模型没有可显示的外观网格。')
        # The PartNet URDF root transform puts the appliance fronts on -X.
        direction = [-1.5, .8, 1.25] if model['source'] == 'partnet' else [1.25, .8, 1.5]
        return {'id': asset_id, 'parts': parts, 'nodes': nodes, 'joints': controls, 'up': 'z',
                'camera_direction': direction, 'warnings': warnings}


def create_model_router(library):
    router = APIRouter(prefix='/api/model-library')

    def checked(call, *args):
        try:
            return call(*args)
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(404, str(exc)) from exc
        except (ValueError, ET.ParseError) as exc:
            raise HTTPException(422, str(exc)) from exc

    @router.get('')
    def listing(q: str = Query('', max_length=200), source: str = Query('', max_length=40),
                category: list[str] | None = Query(None), page: int = Query(1, ge=1, le=100000),
                page_size: int = Query(36, ge=1, le=100), exact_category: str | None = Query(None, max_length=120)):
        return checked(library.list, q, source, category, page, page_size, exact_category)

    @router.get('/categories')
    def categories(q: str = Query('', max_length=200), page: int = Query(1, ge=1, le=100000),
                   page_size: int = Query(36, ge=1, le=100)):
        return checked(library.categories, q, page, page_size)

    @router.get('/category-previews')
    def category_previews(category: str = Query(..., max_length=120), offset: int = Query(0, ge=0, le=100000),
                          limit: int = Query(6, ge=1, le=12)):
        return checked(library.category_previews, category, offset, limit)

    @router.get('/file')
    def file(path: str = Query(..., max_length=2048)):
        target, record = checked(library.file, path)
        return FileResponse(target, filename=target.name, headers={
            'ETag': '"' + record['sha'] + '"', 'X-Content-SHA256': record['sha'],
            'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})

    @router.get('/preparation-status')
    def prepared_status():
        from model_preparation import preparation_status
        return checked(preparation_status, library)

    @router.get('/{asset_id}')
    def detail(asset_id: str):
        return checked(library.get, asset_id)

    @router.get('/{asset_id}/manifest')
    def manifest(asset_id: str):
        return checked(library.manifest, asset_id)

    @router.get('/{asset_id}/preparation')
    def prepared_manifest(asset_id: str):
        from model_preparation import preparation
        return checked(preparation, library, asset_id)

    @router.get('/{asset_id}/preparation/file')
    def prepared_file(asset_id: str, key: str = Query(..., max_length=64),
                      path: str = Query(..., max_length=2048)):
        from model_preparation import preparation_file
        target, record = checked(preparation_file, library, asset_id, key, path)
        return FileResponse(target, filename=target.name, headers={
            'ETag': '"' + record['sha'] + '"', 'X-Content-SHA256': record['sha'],
            'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})

    @router.get('/{asset_id}/view')
    def view(asset_id: str):
        return checked(library.view, asset_id)

    @router.get('/{asset_id}/thumbnail')
    def thumbnail(asset_id: str):
        result = checked(library.thumbnail, asset_id)
        if isinstance(result, Path):
            return FileResponse(result, media_type='image/webp', headers={
                'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff',
                'Vary': 'Authorization, X-Model-Library-Token'})
        return JSONResponse(result, status_code=202 if result['status'] == 'pending' else 200,
                            headers={'Cache-Control': 'no-store', 'Retry-After': '3'})

    @router.get('/{asset_id}/file')
    def asset_file(asset_id: str, path: str = Query(..., max_length=2048)):
        target, record = checked(library.asset_file, asset_id, path)
        return FileResponse(target, filename=target.name, headers={
            'ETag': '"' + record['sha'] + '"', 'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'})

    return router


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--build', action='store_true', required=True)
    args = parser.parse_args()
    print(json.dumps(ModelLibrary(args.root, args.catalog).build(args.manifest)))
