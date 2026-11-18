"""Resumable, hash-verified private catalog transfer. Never removes local assets."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import shlex
import tarfile
import time

import paramiko

REMOTE_ROOT = "/opt/telebot-model-library"

RECEIVER = r'''
import argparse, hashlib, json, os, pathlib, sqlite3, sys, tarfile, time
p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--batch')
p.add_argument('--signature')
p.add_argument('--verify', action='store_true')
p.add_argument('--status', action='store_true')
a = p.parse_args()
root = pathlib.Path(a.root).resolve()
root.mkdir(parents=True, exist_ok=True)
state = root / '_transfer'
state.mkdir(exist_ok=True)
db = sqlite3.connect(state / 'files.sqlite')
db.executescript('CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, size INTEGER, sha TEXT); CREATE INDEX IF NOT EXISTS by_sha ON files(sha,size); CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY, signature TEXT, files INTEGER, bytes INTEGER);')
if a.status:
    import shutil
    print(json.dumps({'batches': dict(db.execute('SELECT id,signature FROM batches')), 'free_bytes': shutil.disk_usage(root).free}))
elif a.verify:
    count = size = 0
    failures = []
    for name, expected_size, expected_sha in db.execute('SELECT path,size,sha FROM files'):
        file = root / 'catalog' / name
        try:
            with file.open('rb') as f:
                digest = hashlib.sha256()
                for block in iter(lambda: f.read(4*1024*1024), b''):
                    digest.update(block)
            if file.stat().st_size != expected_size or digest.hexdigest() != expected_sha:
                failures.append(name)
        except OSError:
            failures.append(name)
        count += 1
        size += expected_size
        if count % 25000 == 0:
            print(json.dumps({'verified_files': count}), flush=True)
    report = {'verified': not failures, 'files': count, 'bytes': size, 'failures': failures, 'time': time.time()}
    (state / 'verification.json').write_text(json.dumps(report), encoding='utf-8')
    print(json.dumps(report), flush=True)
    sys.exit(bool(failures))
else:
    total = count = 0
    catalog = root / 'catalog'
    catalog.mkdir(exist_ok=True)
    with tarfile.open(fileobj=sys.stdin.buffer, mode='r|gz') as stream:
        for member in stream:
            relative = pathlib.PurePosixPath(member.name)
            if not member.isfile() or relative.is_absolute() or '..' in relative.parts or '\\' in member.name:
                raise ValueError('Invalid archive member')
            target = (catalog / member.name).resolve()
            if not target.is_relative_to(catalog.resolve()):
                raise ValueError('Path escapes catalog')
            expected = member.pax_headers.get('TELEBOT.sha256', '')
            if len(expected) != 64:
                raise ValueError('Missing file hash')
            existing = db.execute('SELECT path FROM files WHERE sha=? AND size=? LIMIT 1', (expected, member.size)).fetchone()
            shared = catalog / existing[0] if existing else None
            if shared is not None and (not shared.is_file() or shared.stat().st_size != member.size):
                shared = None
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + '.upload-part')
            digest = hashlib.sha256()
            read = 0
            output = None if shared is not None else temporary.open('wb')
            try:
                with stream.extractfile(member) as source:
                    for block in iter(lambda: source.read(1024*1024), b''):
                        digest.update(block)
                        read += len(block)
                        if output is not None:
                            output.write(block)
            finally:
                if output is not None:
                    output.close()
            if read != member.size or digest.hexdigest() != expected:
                temporary.unlink(missing_ok=True)
                raise ValueError('Transfer hash mismatch: ' + member.name)
            if shared is not None:
                if shared.resolve() != target:
                    temporary.unlink(missing_ok=True)
                    os.link(shared, temporary)
                    os.replace(temporary, target)
            else:
                os.replace(temporary, target)
            os.chmod(target, 0o600)
            db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?)', (member.name, read, expected))
            count += 1
            total += read
            if count % 2000 == 0:
                db.commit()
    db.execute('INSERT OR REPLACE INTO batches VALUES (?,?,?,?)', (a.batch, a.signature, count, total))
    db.commit()
    print(json.dumps({'batch': a.batch, 'verified_files': count, 'bytes': total}), flush=True)
'''


def connect():
    settings = Path(os.environ['LOCALAPPDATA']) / 'CloudServiceConsole/cloud-console-login.json'
    login = json.loads(settings.read_text(encoding='utf-8'))
    if login['host'] != '43.154.250.82':
        raise ValueError('Saved host is not the confirmed Hong Kong server')
    client = paramiko.SSHClient()
    client.load_host_keys(str(Path.home() / '.ssh/known_hosts'))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(login['host'], username=login['username'], password=login['password'],
                   look_for_keys=False, allow_agent=False, timeout=20, auth_timeout=20)
    client.get_transport().set_keepalive(30)
    return client


def remote(client, command, timeout=120):
    _, out, err = client.exec_command(command, timeout=timeout)
    value = out.read().decode('utf-8', errors='replace')
    error = err.read().decode('utf-8', errors='replace')
    if out.channel.recv_exit_status():
        raise RuntimeError(error or value)
    return value


def selected_files(root):
    imports = root / '.imports'
    for collection in sorted(imports.iterdir()):
        if not collection.is_dir():
            continue
        for current, directories, filenames in os.walk(collection):
            directory = Path(current)
            relative = directory.relative_to(collection)
            if relative == Path('.'):
                if collection.name.startswith(('robocasa-aigen_objs-', 'robocasa-objaverse-', 'robocasa-fixtures-')):
                    directories[:] = [name for name in directories if name == 'normalized']
                elif collection.name.startswith('partnet-mobility-'):
                    directories[:] = [name for name in directories if name in {'models', '.index', 'official_files'}]
            directories[:] = sorted(name for name in directories if name not in {'.cache', '__pycache__'})
            for name in sorted(filenames):
                file = directory / name
                if file.suffix.lower() in {'.zip', '.pyc'} or file.name.endswith('.upload-part'):
                    continue
                if file.is_symlink():
                    raise ValueError('Unexpected source symlink: ' + str(file))
                yield file
    for directory in sorted(root.glob('robosuite_*')):
        if directory.is_dir():
            yield from sorted(file for file in directory.rglob('*') if file.is_file())
    for name in ('index.json', 'texture-index.json', 'partnet-import-report.json', 'robocasa-import-report.json', 'gso-tree.json'):
        if (root / name).is_file():
            yield root / name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--upload', action='store_true')
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    root = args.catalog.resolve()
    manifest_path = args.manifest.resolve()
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        if manifest['root'] != str(root):
            raise ValueError('Manifest catalog mismatch')
        files = manifest['files']
        print(json.dumps({'phase': 'reuse_inventory', 'files': len(files)}), flush=True)
    else:
        files = []
        started = time.monotonic()
        for file in selected_files(root):
            before = file.stat()
            with file.open('rb') as handle:
                digest = hashlib.file_digest(handle, 'sha256').hexdigest()
            after = file.stat()
            if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                raise ValueError('Source changed during inventory: ' + str(file))
            files.append({'path': file.relative_to(root).as_posix(), 'bytes': after.st_size,
                          'mtime_ns': after.st_mtime_ns, 'sha256': digest})
            if len(files) % 15000 == 0:
                print(json.dumps({'phase': 'inventory', 'files': len(files), 'seconds': round(time.monotonic()-started)}), flush=True)
        manifest_path.write_text(json.dumps({'root': str(root), 'files': files}), encoding='utf-8')
    unique = {(r['sha256'], r['bytes']) for r in files}
    print(json.dumps({'phase': 'inventory_complete', 'files': len(files), 'bytes': sum(r['bytes'] for r in files),
                      'unique_bytes': sum(size for sha, size in unique)}), flush=True)
    if not (args.upload or args.verify):
        return
    client = connect()
    try:
        remote(client, 'mkdir -p ' + shlex.quote(REMOTE_ROOT + '/_transfer'))
        with client.open_sftp() as sftp:
            with sftp.open(REMOTE_ROOT + '/_transfer/receiver.py', 'w') as target:
                target.write(RECEIVER)
            sftp.chmod(REMOTE_ROOT, 0o700)
        base = 'python3 ' + shlex.quote(REMOTE_ROOT + '/_transfer/receiver.py') + ' --root ' + shlex.quote(REMOTE_ROOT)
        status = json.loads(remote(client, base + ' --status'))
        if not status['batches'] and status['free_bytes'] < sum(size for sha, size in unique) + 5*2**30:
            raise RuntimeError('Insufficient server free space with 5 GiB reserve')
        batches, batch, size = [], [], 0
        for row in files:
            if batch and (size + row['bytes'] > 192*2**20 or len(batch) >= 6000):
                batches.append(batch)
                batch, size = [], 0
            batch.append(row)
            size += row['bytes']
        if batch:
            batches.append(batch)
        if args.upload:
            for number, rows in enumerate(batches):
                batch_id = f'{number:05d}'
                signature = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()
                if status['batches'].get(batch_id) == signature:
                    continue
                started = time.monotonic()
                command = base + ' --batch ' + batch_id + ' --signature ' + signature
                stdin, stdout, stderr = client.exec_command(command, timeout=900)
                with gzip.GzipFile(fileobj=stdin, mode='wb', compresslevel=1) as compressed:
                    with tarfile.open(fileobj=compressed, mode='w|', format=tarfile.PAX_FORMAT) as archive:
                        for row in rows:
                            file = root / row['path']
                            stat = file.stat()
                            if stat.st_size != row['bytes'] or stat.st_mtime_ns != row['mtime_ns']:
                                raise ValueError('Source changed since inventory: ' + str(file))
                            info = tarfile.TarInfo(row['path'])
                            info.size, info.mode, info.mtime = row['bytes'], 0o600, int(stat.st_mtime)
                            info.pax_headers = {'TELEBOT.sha256': row['sha256']}
                            with file.open('rb') as content:
                                archive.addfile(info, content)
                stdin.channel.shutdown_write()
                result = stdout.read().decode()
                error = stderr.read().decode()
                if stdout.channel.recv_exit_status():
                    raise RuntimeError(error or result)
                print(json.dumps({'phase': 'uploaded', 'batch': number+1, 'batches': len(batches),
                                  'seconds': round(time.monotonic()-started), 'result': json.loads(result)}), flush=True)
        if args.verify:
            _, out, err = client.exec_command(base + ' --verify', timeout=1800)
            for line in out:
                print(line.rstrip(), flush=True)
            error = err.read().decode()
            if out.channel.recv_exit_status():
                raise RuntimeError(error or 'Remote verification failed')
    finally:
        client.close()


if __name__ == '__main__':
    main()
