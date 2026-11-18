"""Deploy only the model-library additions, preserving live console configuration."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import shlex

from model_library_transfer import connect, remote

ROOT = Path(__file__).resolve().parents[1]
LIVE = '/opt/cloud-service-console-web'
LIBRARY = '/opt/telebot-model-library'
SERVICE = 'cloud-service-console-web.service'


def insert_once(text, anchor, addition, before=False):
    if addition in text:
        return text
    if text.count(anchor) != 1:
        raise ValueError('Live deployment anchor has changed: ' + anchor[:65])
    return text.replace(anchor, addition + anchor if before else anchor + addition, 1)


def patched_main(live):
    local = (ROOT / 'backend/main.py').read_text(encoding='utf-8')
    live = insert_once(live, 'from capture_store import CaptureFileStore\n',
                      'from model_library import ModelLibrary, create_model_router\n')
    live = insert_once(live, '    "/api/captures/",\n', '    "/api/model-library",\n')
    start = local.index('model_library = ModelLibrary(')
    end = local.index('app.add_middleware(', start)
    live = insert_once(live, 'app.add_middleware(', local[start:end], before=True)
    start = local.index('    if request.method == "GET" and (path == "/api/model-library"')
    end = local.index('    token = _read_web_token(request)', start)
    live = insert_once(live, '    token = _read_web_token(request)\n    account = _account_for_web_token(token)\n',
                       local[start:end], before=True)
    start = local.index('    if path == "/api/model-library" or path.startswith("/api/model-library/"):')
    end = local.index('    if role != "admin" and _path_matches(path, WEB_ADMIN_ONLY_PATH_PREFIXES):', start)
    live = insert_once(live, '    if role != "admin" and _path_matches(path, WEB_ADMIN_ONLY_PATH_PREFIXES):',
                      local[start:end], before=True)
    compile(live, 'main.py', 'exec')
    return live


def write(sftp, path, content, mode=0o600):
    with sftp.open(path, 'wb') as stream:
        stream.write(content.encode() if isinstance(content, str) else content)
    sftp.chmod(path, mode)


ACTIVATE = r'''
import json, os, pathlib, shutil, sqlite3, subprocess, sys, time, urllib.request
stage = pathlib.Path(sys.argv[1]).resolve()
live = pathlib.Path('/opt/cloud-service-console-web')
library = pathlib.Path('/opt/telebot-model-library')
assert stage.parent == live / 'model-library-releases'
expected = json.loads((stage / 'expected.json').read_text())
verified = json.loads((library / '_transfer/verification.json').read_text())
if not verified['verified'] or verified['files'] != expected['files'] or verified['bytes'] != expected['bytes']:
    raise RuntimeError('Remote inventory is not fully verified')
if (stage / 'activated.json').exists():
    raise RuntimeError('This release was already activated')
old_hash = __import__('hashlib').sha256((live / 'backend/main.py').read_bytes()).hexdigest()
if old_hash != expected['main_sha']:
    raise RuntimeError('Live backend changed after staging')
backup = stage / 'backup'
backup.mkdir(mode=0o700)
for source, name in [(live / 'backend/main.py', 'main.py'), (live / 'cloud-console-web.env', 'env')]:
    shutil.copy2(source, backup / name)
    os.chmod(backup / name, 0o600)
module = live / 'backend/model_library.py'
had_module = module.exists()
if had_module:
    shutil.copy2(module, backup / 'model_library.py')
thumbnails = live / 'backend/model_thumbnails.py'
had_thumbnails = thumbnails.exists()
if had_thumbnails:
    shutil.copy2(thumbnails, backup / 'model_thumbnails.py')
taxonomy = live / 'backend/model_category_overrides.json'
had_taxonomy = taxonomy.exists()
if had_taxonomy:
    shutil.copy2(taxonomy, backup / taxonomy.name)
database = library / 'library.sqlite'
had_database = database.exists()
if had_database:
    with sqlite3.connect(str(database)) as source, sqlite3.connect(str(backup / database.name)) as destination:
        source.backup(destination)
python = str(live / '.venv/bin/python')
subprocess.run([python, '-m', 'py_compile', str(stage / 'main.py'), str(stage / 'model_library.py'), str(stage / 'model_thumbnails.py')], check=True)
environment = (live / 'cloud-console-web.env').read_text()
updates = json.loads((stage / 'env-updates.json').read_text())
lines = [line for line in environment.splitlines() if line.split('=', 1)[0] not in updates]
lines += [key + '=' + value for key, value in updates.items()]
(stage / 'env').write_text('\n'.join(lines) + '\n')
os.chmod(stage / 'env', 0o600)
frontend_switched = False
try:
    subprocess.run([python, str(stage / 'model_library.py'), '--root', str(library), '--build'], check=True)
    os.replace(stage / 'main.py', live / 'backend/main.py')
    os.replace(stage / 'model_library.py', module)
    os.replace(stage / 'model_thumbnails.py', thumbnails)
    os.replace(stage / taxonomy.name, taxonomy)
    os.replace(stage / 'env', live / 'cloud-console-web.env')
    if not expected.get('backend_only', False):
        os.rename(live / 'frontend/dist', backup / 'dist')
        frontend_switched = True
        os.rename(stage / 'dist', live / 'frontend/dist')
    subprocess.run(['sudo', 'systemctl', 'restart', 'cloud-service-console-web.service'], check=True)
    last_error = None
    for attempt in range(45):
        try:
            with urllib.request.urlopen('http://127.0.0.1:18080/api/health', timeout=3) as response:
                if response.status == 200:
                    last_error = None
                    break
        except Exception as exc:
            last_error = exc
        time.sleep(1)
    if last_error:
        raise RuntimeError('Console health check failed') from last_error
    (stage / 'activated.json').write_text(json.dumps({'time': time.time(), 'backup': str(backup)}))
    print(json.dumps({'deployed': True, 'backup': str(backup)}), flush=True)
except BaseException:
    shutil.copy2(backup / 'main.py', live / 'backend/main.py')
    shutil.copy2(backup / 'env', live / 'cloud-console-web.env')
    if had_module:
        shutil.copy2(backup / 'model_library.py', module)
    elif module.exists():
        module.unlink()
    if had_thumbnails:
        shutil.copy2(backup / 'model_thumbnails.py', thumbnails)
    elif thumbnails.exists():
        thumbnails.unlink()
    if had_taxonomy:
        shutil.copy2(backup / taxonomy.name, taxonomy)
    else:
        taxonomy.unlink(missing_ok=True)
    if had_database:
        shutil.copy2(backup / database.name, database.with_suffix('.rollback.sqlite'))
        os.replace(database.with_suffix('.rollback.sqlite'), database)
    else:
        database.unlink(missing_ok=True)
    if frontend_switched:
        if (live / 'frontend/dist').exists():
            os.rename(live / 'frontend/dist', stage / 'failed-dist')
        os.rename(backup / 'dist', live / 'frontend/dist')
    subprocess.run(['sudo', 'systemctl', 'restart', 'cloud-service-console-web.service'], check=False)
    raise
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--activate', action='store_true')
    parser.add_argument('--stage', help='Previously prepared remote stage')
    parser.add_argument('--backend-only', action='store_true', help='Leave the deployed frontend unchanged')
    args = parser.parse_args()
    client = connect()
    try:
        if args.stage:
            if not args.stage.startswith(LIVE + '/model-library-releases/') or '..' in args.stage:
                raise ValueError('Invalid release directory')
            stage = args.stage
        else:
            inventory = json.loads((ROOT / 'build/model-library-transfer-manifest.json').read_text(encoding='utf-8'))
            credential = Path.home() / '.config/telebot-model-library.json'
            if credential.exists():
                credentials = json.loads(credential.read_text(encoding='utf-8'))
                if credentials['base_url'] != 'https://console.cityulive.com':
                    raise ValueError('Existing credentials belong to another server')
            else:
                credentials = {'base_url': 'https://console.cityulive.com', 'token': secrets.token_urlsafe(48)}
                credential.parent.mkdir(parents=True, exist_ok=True)
                with credential.open('x', encoding='utf-8') as stream:
                    json.dump(credentials, stream)
                os.chmod(credential, 0o600)
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            stage = LIVE + '/model-library-releases/' + stamp
            remote(client, 'mkdir -p ' + shlex.quote(stage))
            with client.open_sftp() as sftp:
                sftp.chmod(stage, 0o700)
                with sftp.open(LIVE + '/backend/main.py', 'rb') as stream:
                    current = stream.read()
                write(sftp, stage + '/main.py', patched_main(current.decode()))
                write(sftp, stage + '/model_library.py', (ROOT / 'backend/model_library.py').read_bytes())
                write(sftp, stage + '/model_thumbnails.py', (ROOT / 'backend/model_thumbnails.py').read_bytes())
                write(sftp, stage + '/model_category_overrides.json', (ROOT / 'backend/model_category_overrides.json').read_bytes())
                write(sftp, stage + '/activate.py', ACTIVATE)
                write(sftp, stage + '/env-updates.json', json.dumps({
                    'CLOUD_CONSOLE_MODEL_LIBRARY_DIR': LIBRARY,
                    'CLOUD_CONSOLE_MODEL_TOKEN_SHA256': hashlib.sha256(credentials['token'].encode()).hexdigest(),
                }))
                write(sftp, stage + '/expected.json', json.dumps({
                    'main_sha': hashlib.sha256(current).hexdigest(), 'files': len(inventory['files']),
                    'bytes': sum(file['bytes'] for file in inventory['files']),
                    'backend_only': args.backend_only,
                }))
            # Retain old hashed chunks for tabs that were open before this deployment.
            if not args.backend_only:
                remote(client, 'cp -a ' + shlex.quote(LIVE + '/frontend/dist') + ' ' + shlex.quote(stage + '/dist'))
                with client.open_sftp() as sftp:
                    for file in sorted((ROOT / 'frontend/dist').rglob('*')):
                        target = stage + '/dist/' + file.relative_to(ROOT / 'frontend/dist').as_posix()
                        if file.is_dir():
                            try:
                                sftp.mkdir(target)
                            except OSError:
                                sftp.stat(target)
                        else:
                            sftp.put(str(file), target)
            print(json.dumps({'prepared': stage}), flush=True)
        if args.activate:
            print(remote(client, '/opt/cloud-service-console-web/.venv/bin/python ' +
                         shlex.quote(stage + '/activate.py') + ' ' + shlex.quote(stage), timeout=600), flush=True)
    finally:
        client.close()


if __name__ == '__main__':
    main()
