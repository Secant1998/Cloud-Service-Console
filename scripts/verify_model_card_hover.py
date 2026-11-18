"""Check real thumbnail paint while cards tilt and crossfade (read-only cloud access)."""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import threading
import tempfile
from urllib.parse import urlparse
import urllib.request

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--online', action='store_true')
    parser.add_argument('--diagnose', action='store_true')
    parser.add_argument('--software', action='store_true')
    parser.add_argument('--dark-reader', action='store_true')
    parser.add_argument('--out', default='reports/model-card-hover-20261105')
    args = parser.parse_args()
    out = ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)
    credentials = json.loads((Path.home() / '.config/telebot-model-library.json').read_text())
    cache = {}

    def cloud(path):
        if path not in cache:
            request = urllib.request.Request(credentials['base_url'] + path,
                headers={'X-Model-Library-Token': credentials['token']})
            with urllib.request.urlopen(request, timeout=60) as response:
                cache[path] = (response.read(), response.headers.get('Content-Type'), response.status)
        return cache[path]

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = None
    if args.online:
        base = credentials['base_url']
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'frontend/dist')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}'
    status = {'connected': True, 'ssh_target': 'ubuntu@preview', 'public_base_url': base,
        'ingest_mode': 'p2p', 'pending_offers': 0, 'service_running_count': '0', 'health_ok_count': '0',
        'last_refresh': 'now', 'summary_status': 'preview', 'config_path': '', 'services': [], 'health_checks': [],
        'port_checks': [], 'network_snapshot': {'local': {'ip': '-'}, 'server': {'ip': '-'}}}
    report, errors = [], []
    try:
        with sync_playwright() as p:
            flags = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if args.software else []
            if args.dark_reader:
                import os
                extension_root = Path(os.environ['LOCALAPPDATA']) / 'Google/Chrome/User Data/Default/Extensions/eimadpbcbfnmbkopoojfekhnkhdbieeh'
                extension = sorted(extension_root.iterdir())[-1]
                profile = tempfile.TemporaryDirectory(prefix='model-card-darkreader-')
                browser = p.chromium.launch_persistent_context(profile.name, headless=True, channel='msedge',
                    args=flags + [f'--disable-extensions-except={extension}', f'--load-extension={extension}'],
                    viewport={'width': 1440, 'height': 1000})
                page = browser.new_page()
            else:
                browser = p.chromium.launch(headless=True, channel='msedge', args=flags)
                page = browser.new_page(viewport={'width': 1440, 'height': 1000})

            def intercept(route):
                parsed = urlparse(route.request.url)
                path = parsed.path
                if not path.startswith('/api/'):
                    route.continue_()
                    return
                body = {}
                if path == '/api/access':
                    body = {'webMode': True, 'authenticated': True, 'username': 'preview', 'admin': True, 'role': 'admin'}
                elif path in {'/api/status', '/api/status/live'}:
                    body = status
                elif path.startswith('/api/model-library'):
                    assert route.request.method == 'GET'
                    query = parsed.query
                    if path.endswith('/categories'):
                        query += '&q=dishwasher'
                    data, content_type, code = cloud(path + ('?' + query if query else ''))
                    route.fulfill(body=data, content_type=content_type, status=code)
                    return
                route.fulfill(json=body)

            page.route('**/api/**', intercept)
            page.add_init_script("sessionStorage.setItem('cloud-service-console.account-session','preview');")
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base)
            if args.dark_reader:
                page.wait_for_function("document.querySelector('style.darkreader') !== null")
            page.get_by_role('button', name='模型仓库', exact=True).click()
            card = page.locator('[data-category="dishwasher"]')
            card.wait_for()
            card.scroll_into_view_if_needed()
            page.wait_for_function('''el => [...el.querySelectorAll('img')].some(i =>
                i.complete && i.naturalWidth && +getComputedStyle(i).opacity > .98)''', arg=card.element_handle(), timeout=90000)

            def capture(label):
                state = card.evaluate('''el => {
                  const surface = el.querySelector('.model-card-surface');
                  const preview = el.querySelector('.model-card-preview');
                  const css = node => {const s = getComputedStyle(node); return {
                    background:s.background, transform:s.transform, zIndex:s.zIndex, isolation:s.isolation};};
                  const sheen = getComputedStyle(surface, '::after');
                  return {surface:css(surface), preview:css(preview), sheen:{content:sheen.content, background:sheen.background,
                    opacity:sheen.opacity, zIndex:sheen.zIndex}, images:[...el.querySelectorAll('img')].map(i =>
                    ({id:i.dataset.previewId, width:i.naturalWidth, opacity:getComputedStyle(i).opacity}))};
                }''')
                frame = page.screenshot(path=str(out / (label + '.png')), clip=card.bounding_box(), animations='allow')
                im = Image.open(io.BytesIO(frame)).convert('RGB')
                # Interior pixels exclude borders, text, lighting at the edge and shadow.
                center = im.crop((im.width * .15, im.height * .12, im.width * .85, im.height * .55))
                state['image_variance'] = ImageStat.Stat(center).stddev
                state['label'] = label
                report.append(state)
                print(label, 'variance:', [round(v, 1) for v in state['image_variance']],
                    'overlay:', state['sheen'], flush=True)
                return state

            for theme in ['dark', 'light']:
                if page.locator('html').get_attribute('data-theme') != theme:
                    page.get_by_role('button', name='深色模式' if theme == 'dark' else '浅色模式', exact=True).click()
                page.mouse.move(1, 1)
                card.scroll_into_view_if_needed()
                page.wait_for_timeout(400)
                capture(theme + '-before')
                for x, y, corner in [(.2, .2, 'upper-left'), (.8, .8, 'lower-right'), (.5, .5, 'center')]:
                    bounds = card.bounding_box()
                    page.mouse.move(bounds['x'] + bounds['width'] * x, bounds['y'] + bounds['height'] * y, steps=6)
                    page.wait_for_timeout(500)
                    state = capture(theme + '-' + corner)
                    if not args.diagnose:
                        assert state['sheen']['content'] == 'none', ('unexpected card overlay', state)
                        assert max(state['image_variance']) > 12, ('thumbnail painted over', state)
                if args.diagnose:
                    for name, css in [('no-sheen', '.model-card-surface::after {display:none !important}'),
                                      ('no-transform', '.model-card-surface {transform:none !important}')]:
                        style = page.add_style_tag(content=css)
                        page.wait_for_timeout(300)
                        capture(theme + '-' + name)
                        style.evaluate('el => el.remove()')
                page.wait_for_timeout(4500)
                state = capture(theme + '-after-carousel')
                if not args.diagnose:
                    assert max(state['image_variance']) > 12, ('carousel painted over', state)
            assert not errors, errors
            browser.close()
            if args.dark_reader:
                profile.cleanup()
    finally:
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
