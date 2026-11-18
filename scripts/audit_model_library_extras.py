"""Measure original-source files excluded from the runtime transfer, without modifying assets."""
import hashlib
import json
import os
from pathlib import Path
import time


def main():
    output = Path(__file__).resolve().parents[1] / 'build'
    inventory = json.loads((output / 'model-library-transfer-manifest.json').read_text(encoding='utf-8'))
    catalog = Path(inventory['root'])
    existing = {row['path'] for row in inventory['files']}
    known = {(row['sha256'], row['bytes']) for row in inventory['files']}
    extras, archives = [], []
    started = time.monotonic()
    roots = [catalog / '.imports', *sorted(catalog.glob('gso_*'))]
    for root in roots:
        for current, directories, names in os.walk(root):
            directories[:] = sorted(name for name in directories if name not in {'.git', '.cache', '__pycache__'})
            for name in sorted(names):
                file = Path(current) / name
                relative = file.relative_to(catalog).as_posix()
                if relative in existing:
                    continue
                if file.is_symlink():
                    raise ValueError('Unexpected symlink: ' + str(file))
                before = file.stat()
                if file.suffix.lower() == '.zip':
                    archives.append({'path': relative, 'bytes': before.st_size})
                    continue
                if file.suffix.lower() == '.pyc':
                    continue
                with file.open('rb') as stream:
                    sha = hashlib.file_digest(stream, 'sha256').hexdigest()
                after = file.stat()
                if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                    raise ValueError('File changed during audit')
                extras.append({'path': relative, 'bytes': after.st_size, 'mtime_ns': after.st_mtime_ns, 'sha256': sha})
                if len(extras) % 10000 == 0:
                    print(json.dumps({'audited': len(extras), 'seconds': round(time.monotonic() - started)}), flush=True)
    unique = {(row['sha256'], row['bytes']) for row in extras} - known
    summary = {'files': len(extras), 'bytes': sum(row['bytes'] for row in extras),
               'additional_unique_bytes': sum(size for sha, size in unique), 'archive_files': len(archives),
               'archive_bytes': sum(row['bytes'] for row in archives)}
    (output / 'model-library-extra-manifest.json').write_text(json.dumps({'root': str(catalog), 'files': extras, 'archives': archives, 'summary': summary}), encoding='utf-8')
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
