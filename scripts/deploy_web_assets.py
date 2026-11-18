"""Publish built static web assets with atomic entry replacement and rollback."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import deploy_web_console as deploy


def main():
    root = Path(__file__).resolve().parents[1]
    dist = root / 'frontend/dist'
    entries = ['index.html', 'model-thumbnail.html', 'capture-renderer.html']
    replacements = {name: (dist / name).read_bytes() for name in entries}
    saved = deploy.read_saved_login()
    assert saved['host'] == deploy.REMOTE_HOST
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = deploy.REMOTE_BASE + '/backups/web-assets-' + stamp
    remote = deploy.REMOTE_BASE + '/frontend/dist/'
    client = deploy.connect(saved)
    sftp = client.open_sftp()
    snapshots, activated = {}, []

    def atomic(name, data):
        target = remote + name
        temporary = target + '.new-' + stamp
        with sftp.open(temporary, 'wb') as stream:
            stream.write(data)
        sftp.posix_rename(temporary, target)

    try:
        sftp.mkdir(backup)
        for name in entries:
            with sftp.open(remote + name, 'rb') as stream:
                snapshots[name] = stream.read()
            with sftp.open(backup + '/' + name, 'wb') as stream:
                stream.write(snapshots[name])
        uploaded = []
        for path in (dist / 'assets').iterdir():
            if not path.is_file():
                continue
            target = remote + 'assets/' + path.name
            try:
                with sftp.open(target, 'rb') as stream:
                    existing = stream.read()
            except FileNotFoundError:
                existing = None
            data = path.read_bytes()
            if existing == data:
                continue
            assert existing is None, 'Refusing to overwrite an existing hashed asset: ' + path.name
            sftp.put(str(path), target)
            with sftp.open(target, 'rb') as stream:
                assert stream.read() == data, 'Upload verification failed: ' + path.name
            uploaded.append(path.name)
        for name in entries:
            with sftp.open(remote + name, 'rb') as stream:
                assert stream.read() == snapshots[name], 'Entry changed during staging: ' + name
        for name, data in replacements.items():
            activated.append(name)
            atomic(name, data)
        receipt = {'backup': backup, 'uploaded': uploaded,
            'entries': {name: hashlib.sha256(data).hexdigest() for name, data in replacements.items()},
            'service_restarts': False}
        report = root / 'reports/web-assets' / (stamp + '.json')
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        print(json.dumps(receipt), flush=True)
    except Exception:
        for name in activated:
            atomic(name, snapshots[name])
        raise
    finally:
        sftp.close()
        client.close()


if __name__ == '__main__':
    main()
