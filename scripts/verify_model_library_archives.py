"""Check whether local ZIPs contain only data already preserved in the cloud manifests."""
import hashlib
import json
from pathlib import Path
import zipfile


def main():
    build = Path(__file__).resolve().parents[1] / 'build'
    main = json.loads((build / 'model-library-transfer-manifest.json').read_text(encoding='utf-8'))
    extra = json.loads((build / 'model-library-extra-manifest.json').read_text(encoding='utf-8'))
    known = {(r['sha256'], r['bytes']) for r in [*main['files'], *extra['files']]}
    root = Path(main['root'])
    results = []
    for number, record in enumerate(extra['archives'], 1):
        path = root / record['path']
        missing, count = [], 0
        before = path.stat()
        try:
            with zipfile.ZipFile(path) as archive:
                for entry in archive.infolist():
                    if entry.is_dir():
                        continue
                    with archive.open(entry) as stream:
                        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                    if (digest, entry.file_size) not in known:
                        missing.append(entry.filename)
                    count += 1
            with path.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            after = path.stat()
            if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                raise ValueError('ZIP changed during verification')
            result = {**record, 'sha256': digest, 'mtime_ns': after.st_mtime_ns,
                      'covered': not missing, 'members': count, 'missing': missing}
        except (OSError, zipfile.BadZipFile, ValueError) as exc:
            result = {**record, 'covered': False, 'error': str(exc)}
        results.append(result)
        if number % 200 == 0:
            print(json.dumps({'archives_checked': number, 'total': len(extra['archives'])}), flush=True)
    (build / 'model-library-archive-proof.json').write_text(json.dumps(results), encoding='utf-8')
    print(json.dumps({'archives': len(results), 'covered': sum(r['covered'] for r in results),
                      'uncovered': [r['path'] for r in results if not r['covered']]}), flush=True)


if __name__ == '__main__':
    main()
