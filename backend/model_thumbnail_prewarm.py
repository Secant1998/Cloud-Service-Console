"""Resumable full-catalog thumbnail generation; model resources are read-only."""
from __future__ import annotations

import argparse
from contextlib import closing
import json
import os
from pathlib import Path
import shutil
import sys
import time

from PIL import Image


def valid_preview(path):
    try:
        with Image.open(path) as image:
            if image.format != 'WEBP' or image.size != (480, 360):
                return False
            image.load()
            return image.convert('RGBA').getchannel('A').getbbox() is not None
    except (OSError, ValueError):
        return False


def previous_failures(path):
    failures = {}
    if path.is_file():
        for line in path.read_text(encoding='utf-8').splitlines():
            try:
                record = json.loads(line)
                if record.get('error'):
                    failures[record['key']] = record['error']
                else:
                    failures.pop(record['key'], None)
            except (ValueError, KeyError):
                continue
    return failures


def prewarm(library, cache, state_dir, retry_failed=False, minimum_free=1024**3):
    state_dir = Path(state_dir)
    state_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(state_dir, 0o700)
    history = state_dir / 'results.jsonl'
    known_failures = {} if retry_failed else previous_failures(history)
    progress = state_dir / 'progress.json'
    if progress.is_file() and not retry_failed:
        previous = json.loads(progress.read_text(encoding='utf-8'))
        if previous.get('phase') == 'rendering' and previous.get('current_key'):
            known_failures.setdefault(previous['current_key'], 'Previous renderer interrupted; use --retry-failed to retry')
    started = time.time()
    with closing(library.connect()) as db:
        indexed = db.execute('SELECT COUNT(*) FROM models').fetchone()[0]
        # Cover every category early, then work through the remaining members.
        rows = db.execute('''SELECT id FROM (
            SELECT id,category_key(category) AS category,
                ROW_NUMBER() OVER (PARTITION BY category_key(category) ORDER BY label,id) AS rank
            FROM models WHERE available=1
        ) ORDER BY rank,category,id''').fetchall()
    status = {'phase': 'inventory', 'indexed': indexed, 'total': len(rows),
              'metadata_only': indexed - len(rows), 'inspected': 0, 'cached': 0, 'generated': 0,
              'failed': 0, 'ready': 0, 'pending': len(rows), 'bytes': 0, 'current': None, 'current_key': None,
              'started_at': started, 'updated_at': started, 'failures': []}

    def checkpoint():
        status['updated_at'] = time.time()
        status['elapsed_seconds'] = round(status['updated_at'] - started, 1)
        status['ready'] = status['cached'] + status['generated']
        status['pending'] = status['total'] - status['ready'] - status['failed']
        temporary = state_dir / 'progress.part'
        temporary.write_text(json.dumps(status, ensure_ascii=False), encoding='utf-8')
        os.chmod(temporary, 0o600)
        os.replace(temporary, state_dir / 'progress.json')

    def record(asset_id, key, error=None, size=0):
        value = {'id': asset_id, 'key': key, 'time': time.time(), 'bytes': size}
        if error:
            value['error'] = str(error)[-2000:]
            status['failed'] += 1
            status['failures'].append({'id': asset_id, 'error': value['error']})
        with history.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(value, ensure_ascii=False) + '\n')
        os.chmod(history, 0o600)

    checkpoint()
    pending = []
    for row in rows:
        asset_id = row['id']
        key = asset_id
        try:
            target = cache.target(asset_id)
            key = target.name
            if valid_preview(target):
                status['cached'] += 1
                status['bytes'] += target.stat().st_size
            elif key in known_failures:
                record(asset_id, key, known_failures[key])
            else:
                pending.append((asset_id, target))
        except Exception as exc:
            record(asset_id, key, exc)
        status['inspected'] += 1
        if status['inspected'] % 50 == 0:
            checkpoint()
    status['phase'] = 'rendering'
    checkpoint()
    for asset_id, target in pending:
        if shutil.disk_usage(library.root).free < minimum_free:
            status['phase'] = 'waiting_for_disk'
            checkpoint()
            return status
        status['current'] = asset_id
        status['current_key'] = target.name
        checkpoint()
        try:
            # Only remove invalid generated cache files, never source model files.
            if target.exists() and not valid_preview(target):
                target.unlink()
            cache._render(asset_id, target)
            if not valid_preview(target):
                raise ValueError('Renderer did not produce a valid 480x360 WebP')
            size = target.stat().st_size
            status['generated'] += 1
            status['bytes'] += size
            record(asset_id, target.name, size=size)
        except Exception as exc:
            record(asset_id, target.name, exc)
        checkpoint()
        if (status['generated'] + status['failed']) % 25 == 0:
            print(json.dumps({key: status[key] for key in ('phase', 'ready', 'total', 'failed', 'pending')}), flush=True)
    status['current'] = None
    status['current_key'] = None
    status['phase'] = 'completed_with_errors' if status['failed'] else 'completed'
    checkpoint()
    return status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', type=Path, required=True)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--state-dir', type=Path, required=True)
    parser.add_argument('--retry-failed', action='store_true')
    args = parser.parse_args()
    sys.path.insert(0, str(args.backend))
    from model_library import ModelLibrary
    from model_thumbnails import ThumbnailCache
    # The server job is a singleton, including launches outside systemd.
    import fcntl
    args.state_dir.mkdir(parents=True, exist_ok=True)
    with (args.state_dir / '.job.lock').open('a+b') as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('A full-catalog thumbnail job is already running')
        library = ModelLibrary(args.root)
        result = prewarm(library, ThumbnailCache(library), args.state_dir, args.retry_failed)
        print(json.dumps({key: value for key, value in result.items() if key != 'failures'}), flush=True)
        raise SystemExit(2 if result['phase'] == 'waiting_for_disk' else 0)


if __name__ == '__main__':
    main()
