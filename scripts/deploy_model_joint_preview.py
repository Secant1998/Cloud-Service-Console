"""Deploy only joint-preview backend code and built web assets, retaining rollback entries."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shlex
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import deploy_web_console as deploy


def main():
    saved = deploy.read_saved_login()
    assert saved['host'] == deploy.REMOTE_HOST
    root = Path(__file__).resolve().parents[1]
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = deploy.REMOTE_BASE + '/backups/joint-preview-' + stamp
    stage = '/tmp/cloud-console-joints-' + stamp
    client = deploy.connect(saved)
    sftp = client.open_sftp()

    def command(text, timeout=120):
        _, stdout, stderr = client.exec_command(text, timeout=timeout)
        output, error = stdout.read().decode(), stderr.read().decode()
        if stdout.channel.recv_exit_status():
            raise RuntimeError(output + error)
        return output

    def atomic(target, data):
        with sftp.open(target + '.joint-preview-new', 'wb') as stream:
            stream.write(data)
        sftp.posix_rename(target + '.joint-preview-new', target)

    snapshots = {}
    activated = False
    try:
        sftp.mkdir(stage)
        sftp.put(str(root / 'backend/model_library.py'), stage + '/model_library.py')
        audit = '''
from collections import Counter
from contextlib import closing
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from model_library import ModelLibrary, urdf_controls
lib = ModelLibrary(Path('/opt/telebot-model-library'))
types, disabled, failures = Counter(), Counter(), []
with closing(lib.connect()) as db:
    rows = db.execute("SELECT id,entry FROM models WHERE kind='articulated' AND available=1").fetchall()
for row in rows:
    entry = json.loads(row['entry'])
    try:
        xml = ET.parse(lib.catalog / entry['local_descriptor']).getroot()
        joints = urdf_controls(xml)
        types.update(j['type'] for j in joints)
        disabled.update(j['disabled_reason'] for j in joints if j.get('disabled_reason'))
    except Exception as exc:
        failures.append({'id': row['id'], 'error': str(exc)})
assert not failures, failures[:10]
for asset in ['partnet_7119', 'partnet_40147', 'robosuite_milk']:
    view = lib.view(asset)
    assert 'joints' in view
print(json.dumps({'models': len(rows), 'joint_types': types, 'disabled': disabled, 'failures': failures}))
'''
        result = json.loads(command('PYTHONPATH=' + shlex.quote(stage) + ' ' + deploy.REMOTE_BASE + '/.venv/bin/python -c ' + shlex.quote(audit)))
        print('Source audit:', json.dumps(result), flush=True)
        sftp.mkdir(backup)
        entries = ['backend/model_library.py', 'frontend/dist/index.html',
                   'frontend/dist/model-thumbnail.html', 'frontend/dist/capture-renderer.html']
        for relative in entries:
            with sftp.open(deploy.REMOTE_BASE + '/' + relative, 'rb') as stream:
                snapshots[relative] = stream.read()
            with sftp.open(backup + '/' + relative.replace('/', '_'), 'wb') as stream:
                stream.write(snapshots[relative])
        for path in (root / 'frontend/dist/assets').iterdir():
            if not path.is_file():
                continue
            target = deploy.REMOTE_BASE + '/frontend/dist/assets/' + path.name
            try:
                if sftp.stat(target).st_size == path.stat().st_size:
                    continue
            except FileNotFoundError:
                pass
            sftp.put(str(path), target)
        with sftp.open(deploy.REMOTE_BASE + '/backend/model_library.py', 'rb') as stream:
            assert stream.read() == snapshots['backend/model_library.py'], 'Backend changed during staging'
        activated = True
        atomic(deploy.REMOTE_BASE + '/backend/model_library.py', (root / 'backend/model_library.py').read_bytes())
        command('sudo systemctl restart cloud-service-console-web.service')
        for _ in range(20):
            try:
                command("curl --fail --silent http://127.0.0.1:18080/api/access >/dev/null")
                break
            except RuntimeError:
                time.sleep(1)
        else:
            raise RuntimeError('Console health check failed')
        for relative in entries[1:]:
            atomic(deploy.REMOTE_BASE + '/' + relative, (root / relative).read_bytes())
        command('systemctl is-active --quiet cloud-service-console-web.service')
        receipt = {'backup': backup, 'audit': result, 'backend_sha256': hashlib.sha256((root / 'backend/model_library.py').read_bytes()).hexdigest()}
        report = root / 'reports/model-joints-20261105/deployment.json'
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        print('Deployed; rollback snapshot:', backup, flush=True)
    except Exception:
        if activated:
            for relative, data in snapshots.items():
                atomic(deploy.REMOTE_BASE + '/' + relative, data)
            command('sudo systemctl restart cloud-service-console-web.service')
            print('Restored previous console entries.', flush=True)
        raise
    finally:
        sftp.close(); client.close()


if __name__ == '__main__':
    main()
