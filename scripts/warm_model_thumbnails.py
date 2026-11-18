"""Pre-render cloud thumbnails, including a resumable full-catalog server job."""
import argparse
import json
from pathlib import Path
import shlex

from model_library_transfer import connect, remote

JOB_ROOT = '/opt/telebot-model-library/_thumbnail-prewarm'
UNIT = 'telebot-model-thumbnail-prewarm'


def full_catalog(client, retry_failed=False, status_only=False):
    def service_state():
        script = f"import subprocess; print(subprocess.run(['systemctl','is-active','{UNIT}.service'],capture_output=True,text=True).stdout.strip())"
        return remote(client, 'python3 -c ' + shlex.quote(script)).strip()

    active = service_state()
    if not status_only and active not in {'active', 'activating', 'reloading'}:
        remote(client, 'mkdir -p ' + shlex.quote(JOB_ROOT))
        script = Path(__file__).resolve().parents[1] / 'backend/model_thumbnail_prewarm.py'
        with client.open_sftp() as sftp:
            sftp.chmod(JOB_ROOT, 0o700)
            sftp.put(str(script), JOB_ROOT + '/run.py')
            sftp.chmod(JOB_ROOT + '/run.py', 0o600)
        script = f"import subprocess; subprocess.run(['sudo','systemctl','reset-failed','{UNIT}.service'],capture_output=True)"
        remote(client, 'python3 -c ' + shlex.quote(script))
        command = ['sudo', 'systemd-run', '--unit=' + UNIT, '--collect', '--uid=ubuntu',
                   '--property=Nice=15', '--property=CPUQuota=150%', '--property=MemoryHigh=2G',
                   '--property=MemoryMax=3G', '--property=MemorySwapMax=0', '--property=TasksMax=256', '--property=UMask=0077',
                   '--property=Restart=on-failure', '--property=RestartSec=30',
                   '--property=RuntimeMaxSec=2d',
                   '/opt/cloud-service-console-web/.venv/bin/python', '-u', JOB_ROOT + '/run.py',
                   '--backend', '/opt/cloud-service-console-web/backend', '--root', '/opt/telebot-model-library',
                   '--state-dir', JOB_ROOT]
        if retry_failed:
            command.append('--retry-failed')
        remote(client, shlex.join(command))
        active = service_state()
    print(json.dumps({'unit': UNIT, 'active': active, 'progress': JOB_ROOT + '/progress.json'}), flush=True)
    script = '''import json,pathlib
p=pathlib.Path('/opt/telebot-model-library/_thumbnail-prewarm/progress.json')
if p.exists():
    data=json.loads(p.read_text())
    failures=data.pop('failures', [])
    data['failure_examples']=[{'id':r['id'],'error':r['error'].strip().splitlines()[-1]} for r in failures[:5]]
    print(json.dumps(data))
'''
    print(remote(client, 'python3 -c ' + shlex.quote(script)), flush=True)

SCRIPT = r'''
import json, pathlib, sys, time
options = json.loads(sys.argv[1])
base = pathlib.Path(options['stage']) if options['stage'] else pathlib.Path('/opt/cloud-service-console-web')
sys.path.insert(0, str(base if options['stage'] else base / 'backend'))
from model_library import ModelLibrary
from model_thumbnails import ThumbnailCache
library = ModelLibrary(pathlib.Path('/opt/telebot-model-library'))
cache = ThumbnailCache(library, base / 'dist' if options['stage'] else base / 'frontend/dist')
ids = options['assets'] or [item['id'] for item in library.list(page_size=options['limit'])['items'] if item['available']]
failures = []
for asset_id in ids:
    started = time.monotonic()
    try:
        target = cache.target(asset_id)
        cached = target.is_file()
        if not cached:
            cache._render(asset_id, target)
        print(json.dumps({'id': asset_id, 'cached': cached, 'bytes': target.stat().st_size, 'seconds': round(time.monotonic()-started, 2)}), flush=True)
    except Exception as exc:
        failures.append(asset_id)
        print(json.dumps({'id': asset_id, 'error': str(exc)}), flush=True)
print(json.dumps({'completed': len(ids)-len(failures), 'failed': failures}), flush=True)
sys.exit(bool(failures))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage')
    parser.add_argument('--limit', type=int, default=36)
    parser.add_argument('--asset', action='append', default=[])
    parser.add_argument('--all', action='store_true', help='Start a resumable, resource-limited background job for all models')
    parser.add_argument('--status', action='store_true', help='Read full-catalog job status without starting it')
    parser.add_argument('--retry-failed', action='store_true', help='Retry failures when starting a new full-catalog pass')
    args = parser.parse_args()
    if args.stage and (not args.stage.startswith('/opt/cloud-service-console-web/model-library-releases/') or '..' in args.stage):
        raise ValueError('Unexpected staging directory')
    if not 1 <= args.limit <= 100:
        raise ValueError('Limit must be 1..100')
    if (args.all or args.status) and (args.stage or args.asset):
        raise ValueError('Full-catalog jobs use the deployed renderer and all model IDs')
    if args.retry_failed and not args.all:
        raise ValueError('--retry-failed requires --all')
    client = connect()
    try:
        if args.all or args.status:
            full_catalog(client, args.retry_failed, args.status)
            return
        command = '/opt/cloud-service-console-web/.venv/bin/python -u -c ' + shlex.quote(SCRIPT) + ' ' + shlex.quote(
            json.dumps({'stage': args.stage, 'assets': args.asset, 'limit': args.limit}))
        _, out, err = client.exec_command(command, timeout=1800)
        for line in out:
            print(line.rstrip(), flush=True)
        code = out.channel.recv_exit_status()
        if code:
            raise RuntimeError(err.read().decode('utf-8', errors='replace') or 'Some previews failed')
    finally:
        client.close()


if __name__ == '__main__':
    main()
