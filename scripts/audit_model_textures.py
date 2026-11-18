"""Read-only material/UV audit. Structural validity is not semantic visual approval."""
import argparse
from collections import Counter
from contextlib import closing
import json
import math
from pathlib import Path
import shlex
import sys
import time

from PIL import Image


def textured_materials(path):
    result, active = set(), None
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        tokens = shlex.split(line, comments=True)
        if not tokens:
            continue
        if tokens[0] == 'newmtl':
            active = ' '.join(tokens[1:])
        elif active and (tokens[0].lower().startswith('map_') or tokens[0].lower() in {'bump', 'norm'}):
            result.add(active)
    return result


def inspect_obj(path, materials=None):
    count = faces = missing = textured_faces = 0
    low, high = math.inf, -math.inf
    positive_max = 0
    errors = set()
    active = None
    with path.open(encoding='utf-8', errors='replace') as stream:
        for line in stream:
            if line.startswith('vt '):
                try:
                    uv = [float(value) for value in line.split()[1:3]]
                    if len(uv) != 2 or not all(math.isfinite(value) for value in uv):
                        errors.add('UV_NONFINITE_OR_MALFORMED')
                    else:
                        low, high = min(low, *uv), max(high, *uv)
                except ValueError:
                    errors.add('UV_NONFINITE_OR_MALFORMED')
                count += 1
            elif line.startswith('usemtl '):
                active = line[7:].strip()
            elif line.startswith('f '):
                faces += 1
                if materials is not None and active not in materials:
                    continue
                textured_faces += 1
                for corner in line.split()[1:]:
                    if corner.startswith('#'):
                        break
                    fields = corner.split('/')
                    if len(fields) < 2 or not fields[1]:
                        missing += 1
                        continue
                    try:
                        index = int(fields[1])
                        if index == 0 or (index < 0 and count + index < 0):
                            errors.add('UV_INDEX_OUT_OF_RANGE')
                        positive_max = max(positive_max, index)
                    except ValueError:
                        errors.add('UV_INDEX_MALFORMED')
    if positive_max > count:
        errors.add('UV_INDEX_OUT_OF_RANGE')
    if count == 0 and textured_faces:
        errors.add('TEXTURE_WITHOUT_UV')
    if missing:
        errors.add('TEXTURED_FACE_WITHOUT_UV')
    if not faces:
        errors.add('MESH_WITHOUT_FACES')
    return {'uv_count': count, 'faces': faces, 'textured_faces': textured_faces, 'errors': sorted(errors),
            'uv_outside_unit_square': count > 0 and (low < -1e-6 or high > 1 + 1e-6)}


def part_materials(library, part):
    if part.get('texture'):
        return None
    materials = set()
    for material in part['materials']:
        materials.update(textured_materials(library.file(material['file'])[0]))
    return materials


def recheck_materials(library, report, output):
    """Refine only the initial whole-mesh UV findings; retain the completed inventory."""
    started = time.monotonic()
    document = json.loads(Path(report).read_text(encoding='utf-8'))
    rules = {'TEXTURED_FACE_WITHOUT_UV', 'TEXTURE_WITHOUT_UV'}
    checked = models = 0
    for row in document['models']:
        paths = {error['path'] for error in row['errors'] if error['rule'] in rules}
        if not paths:
            continue
        view = library.view(row['id'])
        replacements = []
        for part in view['parts']:
            if part['mesh'] in paths:
                inspection = inspect_obj(library.file(part['mesh'])[0], part_materials(library, part))
                replacements += [{'rule': rule, 'path': part['mesh']} for rule in inspection['errors']]
                checked += 1
        row['errors'] = [error for error in row['errors'] if error['rule'] not in rules] + replacements
        row['status'] = 'requires_review' if row['errors'] or row['warnings'] else 'structurally_valid'
        models += 1
        if models % 50 == 0:
            print(json.dumps({'rechecked_models': models, 'rechecked_meshes': checked,
                              'seconds': round(time.monotonic() - started, 1)}), flush=True)
    summary = document['summary']
    summary.update(material_aware_uv=True, rechecked_models=models, rechecked_meshes=checked,
                   material_recheck_seconds=round(time.monotonic() - started, 1),
                   statuses=dict(Counter(row['status'] for row in document['models'])),
                   errors=dict(Counter(err['rule'] for row in document['models'] for err in row['errors'])))
    Path(output).write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary), flush=True)


def audit(library, output, deep=False):
    from model_library import texture_preview_revision
    started = time.monotonic()
    results, images, meshes = [], {}, {}
    with closing(library.connect()) as db:
        rows = [dict(row) for row in db.execute('SELECT id,source,available FROM models ORDER BY id')]
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    for row in rows:
        result = {**row, 'errors': [], 'warnings': [], 'textured_parts': 0, 'corrected_parts': 0}
        try:
            if not row['available']:
                result['status'] = 'metadata_only'
                results.append(result)
                continue
            model = library.get(row['id'])
            view = library.view(row['id'])
            result['preview_revision'] = texture_preview_revision(model['entry'])
            result['warnings'].extend(view['warnings'])
            for part in view['parts']:
                textures = ([part['texture']] if part.get('texture') else [])
                textures += [path for mtl in part['materials'] for path in mtl['textures'].values()]
                if not textures:
                    continue
                result['textured_parts'] += 1
                result['corrected_parts'] += part.get('texture_flip_y') is False
                for path in textures:
                    if path not in images:
                        try:
                            file, _ = library.asset_file(row['id'], path)
                            with Image.open(file) as image:
                                image.verify()
                            images[path] = None
                        except Exception as exc:
                            images[path] = str(exc)
                    if images[path]:
                        result['errors'].append({'rule': 'TEXTURE_IMAGE_INVALID', 'path': path, 'detail': images[path]})
                if deep and Path(part['mesh']).suffix.lower() == '.obj':
                    path = part['mesh']
                    if path not in meshes:
                        meshes[path] = inspect_obj(library.asset_file(row['id'], path)[0], part_materials(library, part))
                    inspection = meshes[path]
                    result['errors'] += [{'rule': rule, 'path': path} for rule in inspection['errors']]
                    if inspection['uv_outside_unit_square']:
                        # Tiled UVs can be intentional; never flip/clamp them based on bounds alone.
                        result['warnings'].append({'rule': 'UV_TILING_REQUIRES_REVIEW', 'path': path})
            result['status'] = 'requires_review' if result['errors'] or result['warnings'] else 'structurally_valid'
        except Exception as exc:
            result['status'] = 'requires_review'
            result['errors'].append({'rule': 'VIEW_RESOURCE_ERROR', 'detail': str(exc)})
        results.append(result)
        if len(results) % 100 == 0:
            print(json.dumps({'checked': len(results), 'total': len(rows),
                              'seconds': round(time.monotonic() - started, 1)}), flush=True)
    summary = {'models': len(results), 'deep_uv_check': deep, 'material_aware_uv': True,
               'statuses': dict(Counter(row['status'] for row in results)),
               'corrected_models': sum(row['corrected_parts'] > 0 for row in results),
               'corrected_parts': sum(row['corrected_parts'] for row in results),
               'errors': dict(Counter(err['rule'] for row in results for err in row['errors'])),
               'texture_files_verified': len(images), 'textured_meshes_inspected': len(meshes),
               'seconds': round(time.monotonic() - started, 1)}
    output.write_text(json.dumps({'summary': summary, 'models': results}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary), flush=True)
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', type=Path, default=Path(__file__).resolve().parents[1] / 'backend')
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--deep', action='store_true', help='Also scan all textured OBJ UVs and face indices')
    parser.add_argument('--recheck-materials', type=Path, help='Refine whole-mesh UV findings from a completed audit')
    args = parser.parse_args()
    sys.path.insert(0, str(args.backend))
    from model_library import ModelLibrary
    if args.recheck_materials:
        recheck_materials(ModelLibrary(args.root), args.recheck_materials, args.output)
    else:
        audit(ModelLibrary(args.root), args.output, args.deep)
