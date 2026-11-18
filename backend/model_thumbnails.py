"""Bounded, on-demand thumbnail rendering with a private, content-addressed cache."""
from __future__ import annotations

import argparse
import base64
from collections import OrderedDict
from contextlib import closing, contextmanager
import hashlib
import io
import json
import mimetypes
import os
from pathlib import Path
import queue
import shutil
import signal
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, unquote, urlsplit

from PIL import Image, ImageOps
from model_library import texture_preview_revision

VERSION = 'v2'
WIDTH, HEIGHT = 480, 360
RENDER_SCALE = 2
MAX_PENDING = 48
FAILURE_RETRY_SECONDS = 300


@contextmanager
def render_lock(directory):
    """Serialize online and batch renderers without retaining one lock per asset."""
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / '.render.lock').open('a+b') as stream:
        if os.name == 'nt':
            import msvcrt
            if stream.tell() == 0:
                stream.write(b'0')
                stream.flush()
            while True:
                try:
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    time.sleep(.1)
            try:
                yield
            finally:
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


class ThumbnailCache:
    def __init__(self, library, dist=None):
        self.library = library
        self.dist = Path(dist or os.environ.get('CLOUD_CONSOLE_MODEL_RENDERER_DIST') or
                         Path(__file__).resolve().parents[1] / 'frontend/dist').resolve()
        self.directory = library.root / 'previews' / VERSION
        self._lock = threading.Lock()
        self._jobs = queue.Queue(maxsize=MAX_PENDING)
        self._pending = set()
        self._failures = OrderedDict()
        self._keys = OrderedDict()
        self._thread = None

    def target(self, asset_id):
        model = self.library.get(asset_id)
        if not model['available']:
            raise FileNotFoundError('Only metadata is available for this model')
        revision = self.library.database.stat().st_mtime_ns
        with self._lock:
            cached = self._keys.get(asset_id)
            if cached and cached[0] == revision:
                return cached[1]
        prefix = model['directory'] + '/'
        digest = hashlib.sha256((VERSION + '\n' + json.dumps(model['entry'], sort_keys=True)).encode())
        # Preserve unrelated previews while invalidating images with the old UV policy.
        revision_key = texture_preview_revision(model['entry'])
        if revision_key:
            digest.update(('\ntexture-mapping:' + revision_key).encode())
        with closing(self.library.connect()) as db:
            for row in db.execute('SELECT path,sha FROM files WHERE path>=? AND path<? ORDER BY path',
                                  (prefix, prefix + '\uffff')):
                digest.update(json.dumps(list(row)).encode())
        target = self.directory / f'{asset_id}-{digest.hexdigest()[:24]}.webp'
        with self._lock:
            self._keys[asset_id] = (revision, target)
            self._keys.move_to_end(asset_id)
            while len(self._keys) > 256:
                self._keys.popitem(last=False)
        return target

    def request(self, asset_id):
        target = self.target(asset_id)
        if target.is_file():
            return target
        key = target.name
        with self._lock:
            failed = self._failures.get(key)
            if failed and time.monotonic() - failed[0] < FAILURE_RETRY_SECONDS:
                return {'status': 'failed', 'detail': failed[1]}
            if key not in self._pending and not self._jobs.full():
                if shutil.disk_usage(self.library.root).free < 256 * 1024**2:
                    return {'status': 'failed', 'detail': 'Insufficient space for preview cache'}
                self._pending.add(key)
                self._jobs.put_nowait((asset_id, target))
                if self._thread is None or not self._thread.is_alive():
                    self._thread = threading.Thread(target=self._work, name='model-thumbnails', daemon=True)
                    self._thread.start()
        return {'status': 'pending'}

    def _work(self):
        while True:
            asset_id, target = self._jobs.get()
            try:
                self._render(asset_id, target)
                if not target.is_file():
                    raise RuntimeError('Renderer did not produce an image')
            except Exception:
                # Do not expose local paths, browser diagnostics or private credentials to clients.
                with self._lock:
                    self._failures[target.name] = (time.monotonic(), 'Preview unavailable; model details remain accessible')
                    self._failures.move_to_end(target.name)
                    while len(self._failures) > 256:
                        self._failures.popitem(last=False)
                __import__('logging').getLogger(__name__).exception('Thumbnail failed: %s', asset_id)
            finally:
                with self._lock:
                    self._pending.discard(target.name)
                self._jobs.task_done()

    def _render(self, asset_id, target):
        with render_lock(self.directory):
            if not target.is_file():
                self._render_unlocked(asset_id, target)

    def _render_unlocked(self, asset_id, target):
        command = [sys.executable, str(Path(__file__).resolve()), '--root', str(self.library.root),
                   '--catalog', str(self.library.catalog), '--dist', str(self.dist),
                   '--asset', asset_id, '--output', str(target)]
        if os.name != 'nt' and shutil.which('nice'):
            command = ['nice', '-n', '10', *command]
        options = {'start_new_session': True} if os.name != 'nt' else {'creationflags': subprocess.CREATE_NO_WINDOW}
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **options)
        try:
            _, error = process.communicate(timeout=120)
        except subprocess.TimeoutExpired:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            raise RuntimeError('Thumbnail rendering timed out') from None
        if process.returncode:
            raise RuntimeError(error.decode('utf-8', errors='replace')[-2500:])


def save_preview(png, target):
    with Image.open(io.BytesIO(png)) as image:
        image.load()
        if image.size != (WIDTH * RENDER_SCALE, HEIGHT * RENDER_SCALE):
            raise ValueError('Unexpected preview dimensions')
        image = image.convert('RGBA')
        bounds = image.getchannel('A').getbbox()
        if not bounds or bounds[2] - bounds[0] < 8 or bounds[3] - bounds[1] < 8:
            raise ValueError('Empty preview')
        # Fit the visible object, not its bounding sphere, with consistent card margins.
        cropped = ImageOps.contain(image.crop(bounds), (WIDTH - 48, HEIGHT - 48), Image.Resampling.LANCZOS)
        image = Image.new('RGBA', (WIDTH, HEIGHT))
        image.paste(cropped, ((WIDTH - cropped.width) // 2, (HEIGHT - cropped.height) // 2))
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.part')
        try:
            image.save(temporary, format='WEBP', quality=86, method=4)
            os.chmod(temporary, 0o600)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)


def render_one(library, asset_id, dist, target):
    from playwright.sync_api import sync_playwright

    manifest = library.view(asset_id)
    resources = set()
    for part in manifest['parts']:
        resources.add(part['mesh'])
        if part.get('texture'):
            resources.add(part['texture'])
        for material in part.get('materials', []):
            resources.add(material['file'])
            resources.update(material['textures'].values())
    if sum(library.asset_file(asset_id, path)[1]['size'] for path in resources) > 128 * 1024**2:
        raise ValueError('Visual resources exceed the thumbnail worker memory budget')
    origin = 'http://model-thumbnail.invalid'
    prefix = '/api/model-library/' + asset_id
    dist = dist.resolve()
    with sync_playwright() as playwright:
        options = {'headless': True, 'args': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage', '--renderer-process-limit=1', '--num-raster-threads=1']}
        if os.environ.get('CLOUD_CONSOLE_CHROMIUM_PATH'):
            options['executable_path'] = os.environ['CLOUD_CONSOLE_CHROMIUM_PATH']
        browser = playwright.chromium.launch(**options)
        try:
            page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=RENDER_SCALE)
            page.set_default_timeout(60000)

            def serve(route):
                url = urlsplit(route.request.url)
                if url.scheme in {'blob', 'data'}:
                    route.continue_()
                    return
                if url.scheme != 'http' or url.netloc != 'model-thumbnail.invalid' or route.request.method != 'GET':
                    route.abort()
                    return
                path = unquote(url.path)
                if path == prefix + '/view':
                    route.fulfill(json=manifest)
                elif path == prefix + '/file':
                    name = parse_qs(url.query).get('path', [''])[0]
                    file, _ = library.asset_file(asset_id, name)
                    route.fulfill(path=str(file), content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
                elif path == '/model-thumbnail.html' or path.startswith('/assets/'):
                    file = (dist / path.lstrip('/')).resolve()
                    if not file.is_relative_to(dist) or not file.is_file():
                        route.abort()
                        return
                    route.fulfill(path=str(file), content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
                else:
                    route.abort()

            page.route('**/*', serve)
            page.goto(origin + '/model-thumbnail.html', wait_until='load')
            page.wait_for_function('window.modelThumbnail?.ready')
            page.evaluate('(id) => { window.previewResult = null; window.modelThumbnail.render(id).then(result => window.previewResult = result); }', asset_id)
            page.wait_for_function('window.previewResult !== null')
            result = page.evaluate('window.previewResult')
            if result.get('error') or not result.get('png', '').startswith('data:image/png;base64,'):
                raise ValueError(result.get('error') or 'Missing preview image')
            save_preview(base64.b64decode(result['png'].split(',', 1)[1], validate=True), target)
        finally:
            browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--dist', type=Path, required=True)
    parser.add_argument('--asset', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    from model_library import ModelLibrary
    render_one(ModelLibrary(args.root, args.catalog), args.asset, args.dist, args.output)
