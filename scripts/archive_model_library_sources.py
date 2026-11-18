"""Preserve original imported sources as deduplicated, verified cold storage."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import shlex
import subprocess
import tarfile
import time

from model_library_transfer import connect, remote

ROOT = Path(__file__).resolve().parents[1]
DEST = '/opt/telebot-model-library/_sources'
VERIFY = r'''
import gzip, hashlib, json, pathlib, subprocess, sys, tarfile, time
root = pathlib.Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
expected = manifest['unique']
seen = set()
def digest_file(stream):
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
        digest.update(chunk)
    return digest.hexdigest()
filename = manifest.get('archive_name', 'sources.tar.gz')
if filename not in {'sources.tar.gz', 'sources.tar.zst'}:
    raise ValueError('Invalid source archive name')
decoder = subprocess.Popen(['zstd', '-dc', str(root / filename)], stdout=subprocess.PIPE) if filename.endswith('.zst') else None
archive = tarfile.open(fileobj=decoder.stdout, mode='r|') if decoder else tarfile.open(root / filename, 'r|gz')
with archive:
    for member in archive:
        if not member.isfile() or member.name not in expected or member.name in seen:
            raise ValueError('Unexpected source archive entry')
        with archive.extractfile(member) as stream:
            digest = digest_file(stream)
        if digest != member.name or member.size != expected[member.name]:
            raise ValueError('Source archive corruption')
        seen.add(member.name)
        if len(seen) % 15000 == 0:
            print(json.dumps({'source_files_verified': len(seen)}), flush=True)
if seen != set(expected):
    raise ValueError('Incomplete source archive')
if decoder and decoder.wait() != 0:
    raise ValueError('Source decompression failed')
with (root / filename).open('rb') as stream:
    digest = digest_file(stream)
if digest != manifest['archive_sha256']:
    raise ValueError('Archive checksum mismatch')
result = {'verified': True, 'archive_sha256': digest, 'files': len(manifest['files']),
          'unique_files': len(expected), 'archive_name': filename, 'time': time.time()}
(root / 'verification.json').write_text(json.dumps(result))
print(json.dumps(result), flush=True)
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upload', action='store_true')
    parser.add_argument('--compression', choices=['gzip', 'zstd'], default='gzip')
    args = parser.parse_args()
    build = ROOT / 'build'
    base = json.loads((build / 'model-library-transfer-manifest.json').read_text(encoding='utf-8'))
    extras = json.loads((build / 'model-library-extra-manifest.json').read_text(encoding='utf-8'))
    root = Path(base['root'])
    known = {r['sha256']: r['path'] for r in base['files']}
    unique = {r['sha256']: r for r in extras['files'] if r['sha256'] not in known}
    extension = '.tar.zst' if args.compression == 'zstd' else '.tar.gz'
    archive_path = build / ('model-library-sources' + extension)
    manifest_path = build / ('model-library-sources-zstd-manifest.json' if args.compression == 'zstd' else 'model-library-sources-manifest.json')
    if not manifest_path.exists():
        temporary = archive_path.with_name(archive_path.name + '.building')
        started = time.monotonic()
        compressor = None
        with temporary.open('wb') as stream:
            if args.compression == 'zstd':
                compressor = subprocess.Popen(['zstd', '-q', '-15', '-T8', '--long=27', '-c'], stdin=subprocess.PIPE, stdout=stream)
                compressed = compressor.stdin
            else:
                compressed = gzip.GzipFile(fileobj=stream, mode='wb', compresslevel=6, mtime=0)
            with compressed:
                with tarfile.open(fileobj=compressed, mode='w|', format=tarfile.PAX_FORMAT) as archive:
                    for number, (sha, row) in enumerate(unique.items(), 1):
                        file = root / row['path']
                        stat = file.stat()
                        if stat.st_size != row['bytes'] or stat.st_mtime_ns != row['mtime_ns']:
                            raise ValueError('Source changed during archive creation')
                        info = tarfile.TarInfo(sha)
                        info.size, info.mode = row['bytes'], 0o600
                        with file.open('rb') as data:
                            archive.addfile(info, data)
                        if number % 15000 == 0:
                            print(json.dumps({'archived': number, 'total': len(unique), 'seconds': round(time.monotonic() - started)}), flush=True)
            if compressor and compressor.wait() != 0:
                raise RuntimeError('Source compression failed')
        temporary.replace(archive_path)
        with archive_path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        manifest = {'files': extras['files'], 'reuse': {sha: known[sha] for sha in {r['sha256'] for r in extras['files']} if sha in known},
                    'unique': {sha: row['bytes'] for sha, row in unique.items()}, 'archive_sha256': digest,
                    'archive_bytes': archive_path.stat().st_size, 'archive_name': 'sources' + extension}
        manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
    else:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    print(json.dumps({'source_files': len(extras['files']), 'unique_source_files': len(unique),
                      'archive_bytes': archive_path.stat().st_size}), flush=True)
    if not args.upload:
        return
    client = connect()
    try:
        verified = json.loads(remote(client, 'cat /opt/telebot-model-library/_transfer/verification.json'))
        if not verified['verified'] or verified['files'] != len(base['files']):
            raise ValueError('Runtime transfer must finish and verify first')
        free = int(remote(client, "python3 -c 'import shutil;print(shutil.disk_usage(\"/opt/telebot-model-library\").free)'"))
        if free < manifest['archive_bytes'] + 3 * 1024**3:
            raise ValueError('Not enough cloud space for source archive plus 3 GiB reserve')
        remote(client, 'mkdir -p ' + shlex.quote(DEST))
        with client.open_sftp() as sftp:
            sftp.chmod(DEST, 0o700)
            name = manifest.get('archive_name', 'sources' + extension)
            sftp.put(str(archive_path), DEST + '/' + name + '.uploading')
            sftp.chmod(DEST + '/' + name + '.uploading', 0o600)
            sftp.posix_rename(DEST + '/' + name + '.uploading', DEST + '/' + name)
            sftp.put(str(manifest_path), DEST + '/manifest.json')
            sftp.chmod(DEST + '/manifest.json', 0o600)
            with sftp.open(DEST + '/verify.py', 'w') as stream:
                stream.write(VERIFY)
        _, out, err = client.exec_command('python3 ' + DEST + '/verify.py ' + DEST, timeout=1200)
        for line in out:
            print(line.rstrip(), flush=True)
        error = err.read().decode()
        if out.channel.recv_exit_status():
            raise RuntimeError(error or 'Source verification failed')
    finally:
        client.close()


if __name__ == '__main__':
    main()
