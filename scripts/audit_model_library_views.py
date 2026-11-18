"""Check every preview manifest against real model resources without rendering thumbnails."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from model_library import ModelLibrary


def main():
    library = ModelLibrary(ROOT / 'build/model-library-local', Path(r'E:\Desktop\123\code_1015\shared\assets\catalog'))
    with library.connect() as db:
        rows = [dict(row) for row in db.execute('SELECT id,source,available FROM models ORDER BY id')]
    results = []
    started = time.monotonic()
    def check(row):
        try:
            view = library.view(row['id'])
            formats = {Path(part['mesh']).suffix.lower() for part in view['parts']}
            if formats - {'.obj', '.stl', '.msh'}:
                raise ValueError('Unsupported browser mesh formats: ' + str(formats))
            return {**row, 'ok': True, 'parts': len(view['parts']), 'warnings': view['warnings']}
        except Exception as exc:
            return {**row, 'ok': False, 'error': str(exc)}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(check, rows):
            results.append(result)
            if len(results) % 250 == 0:
                print(json.dumps({'checked': len(results), 'total': len(rows), 'seconds': round(time.monotonic() - started)}), flush=True)
    summary = {'total': len(results), 'valid': sum(row['ok'] for row in results),
               'failures': [row for row in results if not row['ok']]}
    (ROOT / 'build/model-library-preview-audit.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'total': summary['total'], 'valid': summary['valid'],
                      'failures_by_source': dict(Counter(row['source'] for row in summary['failures']))}), flush=True)


if __name__ == '__main__':
    main()
