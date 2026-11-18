"""Exercise joint controls with real cloud models, without modifying model data."""
from __future__ import annotations

import argparse
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import sys
import threading
import time
from urllib.parse import parse_qs, quote, urlparse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from model_library import urdf_controls


def png(canvas):
    return base64.b64decode(canvas.evaluate('el => el.toDataURL("image/png").split(",")[1]'))


def different(before, after):
    delta = ImageChops.difference(Image.open(io.BytesIO(before)).convert('RGB'), Image.open(io.BytesIO(after)).convert('RGB'))
    assert max(ImageStat.Stat(delta).mean) > .02, 'model did not visibly move'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--online', action='store_true')
    parser.add_argument('--thumbnail-only', action='store_true')
    parser.add_argument('--indicators-only', action='store_true')
    parser.add_argument('--asset', action='append', help='Model IDs to verify; repeat for multiple models')
    parser.add_argument('--output', type=Path, help='Directory for screenshots and QA results')
    args = parser.parse_args()
    credentials = json.loads((Path.home() / '.config/telebot-model-library.json').read_text())
    out = args.output or ROOT / 'reports/model-joints-20261105' / ('online' if args.online else 'local')
    if args.indicators_only:
        out = out / 'indicators'
    out.mkdir(parents=True, exist_ok=True)
    cache = {}

    def cloud(path):
        if path not in cache:
            request = urllib.request.Request(credentials['base_url'] + path, headers={'X-Model-Library-Token': credentials['token']})
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(request, timeout=120) as response:
                        cache[path] = (response.read(), response.headers.get('Content-Type', 'application/octet-stream'))
                    break
                except urllib.error.HTTPError as error:
                    if error.code not in {502, 503, 504} or attempt == 2:
                        raise RuntimeError(f'Cloud resource failed: {error.code} {path}') from error
                    time.sleep(1)
        return cache[path]

    models, views = {}, {}
    for asset in args.asset or ['partnet_7119', 'partnet_40147', 'robosuite_milk']:
        model = json.loads(cloud('/api/model-library/' + asset)[0])
        view = json.loads(cloud('/api/model-library/' + asset + '/view')[0])
        if model['entry'].get('descriptor_format') == 'urdf':
            descriptor = model['entry']['local_descriptor']
            source = cloud(f'/api/model-library/{asset}/file?path={quote(descriptor)}')[0]
            controls = urdf_controls(ET.fromstring(source))
            if args.online:
                assert view['joints'] == controls, 'deployed joint metadata differs from source URDF'
            else:
                view['joints'] = controls
        models[asset], views[asset] = model, view
        print(asset, [(j['name'], j['type'], j.get('disabled_reason')) for j in view.get('joints', [])], flush=True)

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
            browser = p.chromium.launch(headless=True, channel='msedge', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            context = browser.new_context(viewport={'width': 1440, 'height': 1000})

            def intercept(route):
                parsed = urlparse(route.request.url)
                path = parsed.path
                if not path.startswith('/api/'):
                    route.continue_()
                    return
                if path.startswith('/api/model-library'):
                    assert route.request.method == 'GET', 'preview must not mutate cloud models'
                body = {}
                if path == '/api/access':
                    body = {'webMode': True, 'authenticated': True, 'username': 'preview', 'admin': True, 'role': 'admin'}
                elif path in {'/api/status', '/api/status/live'}:
                    body = status
                elif path == '/api/model-library/categories':
                    categories = {}
                    for model in models.values():
                        categories.setdefault(model['category'], []).append({'id': model['id'], 'label': model['label']})
                    body = {'items': [{'category': category, 'count': len(items), 'stored': len(items),
                        'previews': {'items': items, 'total': len(items), 'offset': 0}} for category, items in categories.items()],
                        'total': len(categories), 'stored': len(models), 'indexed': len(models), 'page': 1, 'page_size': 36}
                elif path == '/api/model-library':
                    category = parse_qs(parsed.query).get('exact_category', [''])[0]
                    items = [m for m in models.values() if not category or m['category'] == category]
                    body = {'items': items, 'total': len(items), 'indexed': len(models), 'stored': len(models), 'page': 1, 'page_size': 36,
                        'sources': [{'source': m['source'], 'count': 1} for m in items], 'categories': []}
                elif path.startswith('/api/model-library/'):
                    asset = path.split('/')[3]
                    if path.endswith('/view'):
                        body = views[asset]
                    elif asset in models and path == '/api/model-library/' + asset:
                        body = models[asset]
                    else:
                        data, content_type = cloud(path + ('?' + parsed.query if parsed.query else ''))
                        route.fulfill(body=data, content_type=content_type)
                        return
                route.fulfill(json=body)

            context.route('**/api/**', intercept)
            context.add_init_script("sessionStorage.setItem('cloud-service-console.account-session','preview');")
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base)
            page.get_by_role('button', name='模型仓库', exact=True).click()
            for asset, model in ([] if args.thumbnail_only else models.items()):
                page.locator(f'[data-category="{model["category"]}"]').click()
                page.locator(f'[data-model-id="{asset}"]').click()
                canvas = page.locator('.model-viewport canvas')
                canvas.wait_for()
                page.wait_for_function("() => !document.querySelector('.model-viewport-status')", timeout=180000)
                assert page.locator('.model-viewport-error').count() == 0
                joints = views[asset].get('joints', [])
                assert page.locator('[data-joint]').count() == len(joints)
                for joint in joints:
                    button = page.locator('[data-joint]').filter(has_text=joint['name'])
                    if joint.get('disabled_reason'):
                        assert button.is_disabled()
                        continue
                    button.click()
                    assert button.get_attribute('aria-pressed') == 'true'
                    slider = page.get_by_role('slider', name='关节位置')
                    if joint.get('mimic'):
                        assert slider.is_disabled()
                        continue
                    slider.focus(); slider.press('Home')
                    before = png(canvas)
                    if args.indicators_only:
                        page.locator('.model-viewport-shell').screenshot(path=str(out / f'{asset}-{joint["name"]}-closed.png'))
                    slider.press('End')
                    if joint['type'] != 'continuous':
                        different(before, png(canvas))
                    expected = joint['upper'] * (1000 if joint['type'] == 'prismatic' else 180 / 3.141592653589793) if joint['upper'] is not None else 180
                    page.wait_for_function('(expected) => Math.abs(Number(document.querySelector(".model-joint-value input").value) - expected) < .11', arg=expected, timeout=3000)
                    page.screenshot(path=str(out / f'{asset}-{joint["name"]}-open.png'))
                    if args.indicators_only:
                        def marker_pixels(data):
                            image = Image.open(io.BytesIO(data)).convert('RGB')
                            points = [(i % image.width, i // image.width) for i, (r, g, b) in enumerate(image.getdata()) if r < 60 and g > 100 and b > 90 and g > b]
                            assert len(points) > 12, 'joint marker is missing'
                            return [sum(p[axis] for p in points) / len(points) for axis in (0, 1)]
                        start, end = marker_pixels(before), marker_pixels(png(canvas))
                        if joint['type'] == 'prismatic':
                            assert sum((a - b) ** 2 for a, b in zip(start, end)) > 16, 'slide marker did not follow moving part'
                    page.get_by_role('button', name='复位选中关节', exact=True).click()
                if joints and args.indicators_only:
                    chosen = next((joint for joint in joints if joint['type'] == 'prismatic'), joints[0])
                    button = page.locator(f'[data-joint="{chosen["name"]}"]')
                    if button.get_attribute('aria-pressed') != 'true':
                        button.click()
                    numeric = page.get_by_role('spinbutton', name='关节数值')
                    position = (chosen['lower'] + chosen['upper']) / 2 if chosen['lower'] is not None and chosen['upper'] is not None else .5
                    numeric.fill(str(position * (1000 if chosen['type'] == 'prismatic' else 180 / 3.141592653589793))); numeric.press('Enter')
                    for width, height in [(1440, 1000), (390, 844)]:
                        page.set_viewport_size({'width': width, 'height': height})
                        for theme in ['light', 'dark']:
                            if page.locator('html').get_attribute('data-theme') != theme:
                                page.get_by_role('button', name='深色模式' if theme == 'dark' else '浅色模式', exact=True).click()
                            page.locator('.model-viewport-shell').scroll_into_view_if_needed()
                            page.locator('.model-viewport-shell').screenshot(path=str(out / f'{asset}-{width}-{theme}.png'))
                            marker_pixels(png(canvas))
                    page.set_viewport_size({'width': 1440, 'height': 1000})
                if joints and not args.indicators_only:
                    first = next(j for j in joints if not j.get('disabled_reason') and not j.get('mimic'))
                    button = page.locator(f'[data-joint="{first["name"]}"]')
                    if button.get_attribute('aria-pressed') != 'true':
                        button.click()
                    numeric = page.get_by_role('spinbutton', name='关节数值')
                    position = (first['lower'] + first['upper']) / 2 if first['lower'] is not None and first['upper'] is not None else .5
                    numeric.fill(str(position * (1000 if first['type'] == 'prismatic' else 180 / 3.141592653589793))); numeric.press('Enter')
                    page.wait_for_timeout(100)
                    previous = float(numeric.input_value())
                    page.screenshot(path=str(out / f'{asset}-drag-start.png'))
                    bounds = canvas.bounding_box()
                    dragged = False
                    for iy in range(6, 15):
                        for ix in range(5, 16):
                            x, y = bounds['x'] + bounds['width'] * ix / 20, bounds['y'] + bounds['height'] * iy / 20
                            page.mouse.move(x, y)
                            if canvas.evaluate('el => el.style.cursor') == 'ew-resize':
                                page.mouse.down(); page.mouse.move(x + 70, y, steps=8); page.mouse.up()
                                page.wait_for_timeout(100)
                                dragged = abs(float(numeric.input_value()) - previous) > .1
                                print('drag', asset, previous, numeric.input_value(), flush=True)
                                break
                        if dragged:
                            break
                    assert dragged, 'selected part cannot be dragged'
                    page.get_by_role('button', name='复位全部关节', exact=True).click()
                    page.get_by_role('button', name='全屏', exact=True).click()
                    page.wait_for_function("() => document.fullscreenElement?.classList.contains('model-viewport-shell')")
                    assert page.locator('.model-joints').is_visible()
                    page.get_by_role('button', name='全屏', exact=True).click()
                    for width, height in [(1440, 1000), (390, 844)]:
                        page.set_viewport_size({'width': width, 'height': height})
                        for theme in ['light', 'dark']:
                            if page.locator('html').get_attribute('data-theme') != theme:
                                page.get_by_role('button', name='深色模式' if theme == 'dark' else '浅色模式', exact=True).click()
                            page.locator('.model-viewport-shell').scroll_into_view_if_needed()
                            page.screenshot(path=str(out / f'{asset}-{width}-{theme}.png'))
                            assert page.locator('.model-joints').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
                            assert canvas.bounding_box()['height'] >= 200
                            assert max(ImageStat.Stat(Image.open(io.BytesIO(png(canvas)))).stddev[:3]) > 4, 'blank canvas'
                    page.set_viewport_size({'width': 1440, 'height': 1000})
                    page.get_by_role('button', name='取消关节选择', exact=True).click()
                    assert page.locator('.model-joint-control').count() == 0
                report.append({'asset': asset, 'joints': len(joints), 'rendered': True})
                page.get_by_role('button', name='返回模型列表', exact=True).click()
                page.get_by_role('button', name='返回全部类别', exact=True).click()
            thumbnail = context.new_page()
            thumbnail.on('pageerror', lambda error: errors.append(str(error)))
            if args.online:
                # The real worker serves this internal HTML from disk, not through web login.
                # Its hashed JS/CSS still come from the deployed public assets here.
                thumbnail.route('**/model-thumbnail.html', lambda route: route.fulfill(
                    path=str(ROOT / 'frontend/dist/model-thumbnail.html'), content_type='text/html'))
            thumbnail.goto(base + '/model-thumbnail.html')
            thumbnail.wait_for_function('() => window.modelThumbnail?.ready')
            result = thumbnail.evaluate('(asset) => window.modelThumbnail.render(asset)', next(iter(models)))
            assert result.get('png') and not result.get('error'), result
            image = Image.open(io.BytesIO(base64.b64decode(result['png'].split(',')[1])))
            assert image.getbbox() and max(ImageStat.Stat(image).stddev[:3]) > 4
            image.save(out / 'thumbnail.png')
            assert not errors, errors
            report_name = 'thumbnail-report.json' if args.thumbnail_only else 'report.json'
            (out / report_name).write_text(json.dumps({'checks': report, 'errors': errors, 'thumbnail': True}, indent=2))
            print(json.dumps(report), flush=True)
            browser.close()
    finally:
        if server:
            server.shutdown(); server.server_close()


if __name__ == '__main__':
    main()
