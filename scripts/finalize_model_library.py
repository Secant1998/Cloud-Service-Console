"""Remove only byte-verified migrated bulk files; preserve indices, edits and generated scenes."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import time

from model_library_transfer import connect, remote

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_CATALOG = Path(r'E:\Desktop\123\code_1015\shared\assets\catalog').resolve()
METADATA_SUFFIXES = {'.json', '.xml', '.urdf', '.md', '.txt', '.mtl', '.yaml', '.yml'}


def inventory_signature(rows):
    digest = hashlib.sha256()
    for row in sorted(rows, key=lambda row: row['path']):
        digest.update(json.dumps([row['path'], row['bytes'], row['sha256']], separators=(',', ':')).encode())
        digest.update(b'\n')
    return digest.hexdigest()


REMOTE_SIGNATURE = '''python3 - <<'PY'
import hashlib, json, sqlite3
db = sqlite3.connect('file:/opt/telebot-model-library/_transfer/files.sqlite?mode=ro', uri=True)
digest = hashlib.sha256()
for row in db.execute('SELECT path,size,sha FROM files ORDER BY path'):
    digest.update(json.dumps(list(row), separators=(',', ':')).encode())
    digest.update(b'\\n')
print(digest.hexdigest())
PY'''


def checked_relative(root, relative):
    part = PurePosixPath(relative)
    if part.is_absolute() or '..' in part.parts or ':' in relative or '\\' in relative:
        raise ValueError('Invalid cleanup path')
    if len(part.parts) < 2 or not (part.parts[0] == '.imports' or part.parts[0].startswith(('gso_', 'robosuite_'))):
        raise ValueError('Cleanup target is outside model data directories')
    return root / relative


def checked_path(root, relative):
    unresolved = checked_relative(root, relative)
    path = unresolved.resolve()
    compared = Path(str(path).removeprefix('\\\\?\\'))
    compared_root = Path(str(root).removeprefix('\\\\?\\'))
    if compared == compared_root or not compared.is_relative_to(compared_root) or unresolved.is_symlink():
        raise ValueError('Cleanup target escapes intended catalog')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remove-verified', action='store_true')
    parser.add_argument('--runtime-only', action='store_true')
    args = parser.parse_args()
    build = ROOT / 'build'
    primary = json.loads((build / 'model-library-transfer-manifest.json').read_text(encoding='utf-8'))
    root = Path(primary['root']).resolve()
    if root != EXPECTED_CATALOG:
        raise ValueError('Unexpected local catalog root')
    marker = json.loads((root / 'remote-library.json').read_text(encoding='utf-8'))
    proof = json.loads((build / 'model-library-cache-proof.json').read_text(encoding='utf-8'))
    if not proof['passed'] or proof['base_url'] != marker['base_url'] or time.time() - proof['time'] > 86400:
        raise ValueError('A recent successful on-demand acquisition test is required')
    client = connect()
    rows = list(primary['files'])
    source_manifest = None
    try:
        runtime = json.loads(remote(client, 'cat /opt/telebot-model-library/_transfer/verification.json'))
        if not runtime['verified'] or runtime['files'] != len(rows):
            raise ValueError('Cloud runtime inventory is not verified')
        if inventory_signature(rows) != remote(client, REMOTE_SIGNATURE).strip():
            raise ValueError('Cloud and local inventories differ')
        if not args.runtime_only:
            sources = json.loads(remote(client, 'cat /opt/telebot-model-library/_sources/verification.json'))
            source_manifest_path = build / ('model-library-sources-zstd-manifest.json' if sources.get('archive_name') == 'sources.tar.zst' else 'model-library-sources-manifest.json')
            source_manifest = json.loads(source_manifest_path.read_text(encoding='utf-8'))
            if not sources['verified'] or sources['archive_sha256'] != source_manifest['archive_sha256']:
                raise ValueError('Original-source archive is not verified')
            source_manifest_sha = hashlib.sha256(source_manifest_path.read_bytes()).hexdigest()
            remote_sha = remote(client, 'sha256sum /opt/telebot-model-library/_sources/manifest.json').split()[0]
            if remote_sha != source_manifest_sha:
                raise ValueError('Cloud source manifest differs from local inventory')
            rows.extend(source_manifest['files'])
            rows.extend(row for row in json.loads((build / 'model-library-archive-proof.json').read_text(encoding='utf-8')) if row['covered'])
    finally:
        client.close()
    candidates = []
    for row in rows:
        part = PurePosixPath(row['path'])
        collection_metadata = part.parts[0] == '.imports' and len(part.parts) == 3
        if len(part.parts) < 2 or (collection_metadata and part.suffix.lower() in METADATA_SUFFIXES and row['bytes'] < 32 * 1024**2):
            continue
        candidates.append((checked_relative(root, row['path']), row))
    print(json.dumps({'phase': 'verified_cleanup_plan', 'files': len(candidates),
                      'bytes': sum(row['bytes'] for path, row in candidates), 'root': str(root)}), flush=True)
    if not args.remove_verified:
        return
    deleted = missing = total = 0
    skipped = []
    log_path = build / 'model-library-local-cleanup.jsonl'
    # Exact-file operations only. No recursive delete and no generated scene paths.
    with log_path.open('a', encoding='utf-8') as log:
        for index, (path, row) in enumerate(candidates, 1):
            if not path.is_file():
                missing += 1
                continue
            try:
                path = checked_path(root, row['path'])
                stat = path.stat()
                if stat.st_size != row['bytes'] or stat.st_mtime_ns != row['mtime_ns']:
                    raise ValueError('File changed since inventory')
                with path.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                after = path.stat()
                if digest != row['sha256'] or after.st_mtime_ns != stat.st_mtime_ns or after.st_size != stat.st_size:
                    raise ValueError('File changed during verification')
                path.unlink()
                total += row['bytes']
                deleted += 1
                log.write(json.dumps({'path': row['path'], 'sha256': digest, 'bytes': row['bytes']}) + '\n')
            except (OSError, ValueError) as exc:
                skipped.append({'path': row['path'], 'reason': str(exc)})
            if index % 25000 == 0:
                log.flush()
                print(json.dumps({'checked': index, 'deleted': deleted, 'bytes_released': total}), flush=True)
    summary = {'deleted': deleted, 'already_missing': missing, 'bytes_released': total, 'skipped': skipped, 'time': time.time()}
    (build / 'model-library-cleanup-summary.json').write_text(json.dumps(summary), encoding='utf-8')
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
