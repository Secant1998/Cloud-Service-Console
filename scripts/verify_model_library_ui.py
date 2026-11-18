"""Exercise the real catalog and Three.js viewer locally, with no production mutations."""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
from pathlib import Path
import sys
import threading
import time
from urllib.parse import parse_qs, quote, urlparse
import urllib.request

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from model_library import ModelLibrary, create_model_router


def wait_listing(page, full_page=True):
    page.wait_for_function('''() => {
      const grid = document.querySelector('.model-library:not([hidden]) .model-grid');
      if (!grid || grid.getAttribute('aria-busy') !== 'false') return false;
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      return grid.children.length === columns * Math.max(1, Math.floor(36 / columns));
    }''' if full_page else '''() => document.querySelector('.model-library:not([hidden]) .model-grid')?.getAttribute('aria-busy') === 'false' ''')


def category_card(page, category):
    previous = page.get_by_role('button', name='上一页', exact=True)
    while previous.is_enabled():
        previous.click()
        wait_listing(page, full_page=False)
    for _ in range(20):
        card = page.locator(f'.model-library:not([hidden]) [data-category="{category}"]')
        if card.count():
            return card
        next_page = page.get_by_role('button', name='下一页', exact=True)
        assert next_page.is_enabled(), f'Category missing: {category}'
        next_page.click()
        wait_listing(page, full_page=False)
    raise AssertionError(f'Category not found in 20 pages: {category}')


def check_model_search(page, out):
    search = page.get_by_role('searchbox', name='搜索模型', exact=True)

    def query(value, source='', category=None):
        with page.expect_response(lambda r: urlparse(r.url).path == '/api/model-library' and
                parse_qs(urlparse(r.url).query).get('q', ['']) == [value]) as response:
            search.fill(value)
        result = response.value.json()
        params = parse_qs(urlparse(response.value.url).query)
        assert params.get('source', ['']) == [source], params
        assert params.get('exact_category') == ([category] if category is not None else None), params
        wait_listing(page, full_page=False)
        assert page.locator('.model-library:not([hidden]) [data-model-id]').count() == len(result['items'])
        assert page.locator('.model-library:not([hidden]) [data-category]').count() == 0
        return result

    def source(value):
        page.get_by_role('button', name='来源', exact=True).click()
        with page.expect_response(lambda r: urlparse(r.url).path == '/api/model-library' and
                parse_qs(urlparse(r.url).query).get('source', ['']) == [value]) as response:
            menu = page.get_by_role('listbox', name='来源', exact=True)
            menu.get_by_role('option').filter(has_text={'partnet': 'PartNet-Mobility', 'gso': 'GSO'}[value]).click()
        wait_listing(page, full_page=False)
        return response.value.json()

    result = query('40147')
    assert any(item['id'] == 'partnet_40147' for item in result['items'])
    result = query('partnet_40147')
    assert [item['id'] for item in result['items']] == ['partnet_40147']
    for width, height in [(1440, 1000), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        wait_listing(page, full_page=False)
        for theme in ['light', 'dark']:
            set_theme(page, theme)
            page.locator('.model-library:not([hidden]) .model-library-heading').scroll_into_view_if_needed()
            page.screenshot(path=str(out / f'model-search-{width}-{theme}.png'))
            assert page.locator('.model-library:not([hidden])').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    set_theme(page, 'light')
    card = page.locator('[data-model-id="partnet_40147"]')
    card.scroll_into_view_if_needed()
    position = scroll_positions(page)
    card.click()
    page.locator('.model-metadata .model-id').get_by_text('partnet_40147', exact=True).wait_for()
    assert page.locator('.model-library:visible').count() == 0
    page.get_by_role('button', name='返回模型列表', exact=True).click()
    wait_listing(page, full_page=False)
    assert search.input_value() == 'partnet_40147'
    assert card.evaluate('el => el === document.activeElement')
    assert scroll_positions(page) == position
    assert source('gso')['total'] == 0, 'source filter leaked PartNet results'
    assert any(item['id'] == 'partnet_40147' for item in source('partnet')['items'])
    result = query('', source='partnet')
    assert result['total'] > 1 and all(item['source'] == 'partnet' for item in result['items'])
    page.get_by_role('button', name='返回全部类别', exact=True).click()
    wait_listing(page)
    assert search.input_value() == ''
    assert page.get_by_role('button', name='来源', exact=True).count() == 0
    assert page.locator('.model-library:not([hidden]) [data-model-id]').count() == 0
    category_card(page, 'bottle').click()
    wait_listing(page, full_page=False)
    assert query('40147', category='bottle')['total'] == 0, 'category filter leaked cabinet results'
    query('', category='bottle')
    scoped = source('partnet')
    asset_id = scoped['items'][0]['id']
    result = query(asset_id, source='partnet', category='bottle')
    assert [item['id'] for item in result['items']] == [asset_id]
    assert all(item['category'] == 'bottle' and item['source'] == 'partnet' for item in result['items'])
    query('no-such-model-search-1937', source='partnet', category='bottle')
    page.get_by_text('没有匹配的模型', exact=True).wait_for()
    page.get_by_role('button', name='返回全部类别', exact=True).click()
    wait_listing(page, full_page=False)
    assert search.input_value() == ''
    query('BOTTLE')
    assert page.locator('.model-library:not([hidden]) [data-model-id]').count() > 0
    page.get_by_role('button', name='返回全部类别', exact=True).click()
    wait_listing(page)
    return {'global_numeric_id': True, 'global_full_id': True, 'global_keyword': True,
            'category_and_source_intersection': True, 'source_preserved_on_query_clear': True,
            'detail_return_preserves_state': True, 'desktop_mobile_light_dark': True}


def set_theme(page, theme):
    if page.locator('html').get_attribute('data-theme') != theme:
        page.get_by_role('button', name='深色模式' if theme == 'dark' else '浅色模式', exact=True).click()
    page.wait_for_function('(theme) => document.documentElement.dataset.theme === theme', arg=theme)
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')


def canvas_png(canvas):
    return base64.b64decode(canvas.evaluate('el => el.toDataURL("image/png").split(",")[1]'))


def scroll_positions(page):
    return page.evaluate('''() => [window.scrollY, ...Array.from(document.querySelectorAll('*'))
      .filter(el => el.getClientRects().length && !el.closest('.app-select-menu') && el.scrollHeight > el.clientHeight &&
        ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)).map(el => el.scrollTop)]''')


def check_library_layout(page, out):
    page.set_viewport_size({'width': 2300, 'height': 1200})
    wait_listing(page)
    ids = page.locator('.model-library:not([hidden]) .model-card').evaluate_all('(items) => items.map(el => el.dataset.category)')
    columns = page.locator('.model-library:not([hidden]) .model-grid').evaluate('el => getComputedStyle(el).gridTemplateColumns.split(" ").length')
    assert columns >= 7 and len(ids) % columns == 0, (columns, len(ids))
    page.screenshot(path=str(out / 'library-wide.png'), full_page=True)
    page.set_viewport_size({'width': 2100, 'height': 1200})
    wait_listing(page)
    medium_columns = page.locator('.model-library:not([hidden]) .model-grid').evaluate('el => getComputedStyle(el).gridTemplateColumns.split(" ").length')
    assert medium_columns >= 6
    ids = page.locator('.model-library:not([hidden]) .model-card').evaluate_all('(items) => items.map(el => el.dataset.category)')
    assert len(ids) % medium_columns == 0
    assert page.locator('.model-card-category').count() == 0
    assert page.locator('.model-library:not([hidden]) .model-card').first.bounding_box()['width'] >= 250
    page.screenshot(path=str(out / 'library-medium.png'), full_page=True)
    page.get_by_role('button', name='下一页', exact=True).click()
    wait_listing(page)
    second = page.locator('.model-library:not([hidden]) .model-card').evaluate_all('(items) => items.map(el => el.dataset.category)')
    assert set(ids).isdisjoint(second)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    wait_listing(page)
    assert page.locator(f'[data-category="{second[0]}"]').count() == 1, 'resize skipped current offset'
    previous = page.get_by_role('button', name='上一页', exact=True)
    if previous.is_enabled():
        previous.click()
    wait_listing(page)

    for width, height in [(1440, 1000), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        wait_listing(page)
        for theme in ['light', 'dark']:
            set_theme(page, theme)
            page.locator('.model-library:not([hidden]) .model-library-heading').scroll_into_view_if_needed()
            page.screenshot(path=str(out / f'library-{width}-{theme}.png'))
            check_category_navigation(page, out, width, theme)
        heading = page.locator('.model-library:not([hidden]) .model-library-heading').bounding_box()
        search = page.locator('.model-library:not([hidden]) .model-search').bounding_box()
        assert search['y'] - (heading['y'] + heading['height']) <= 16
        assert page.locator('.model-library:not([hidden])').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    set_theme(page, 'light')
    wait_listing(page)
    return {'wide_columns': columns, 'medium_columns': medium_columns, 'page_items': len(ids), 'pagination': True, 'category_first': True}


def check_category_navigation(page, out, width, theme):
    assert page.get_by_role('button', name='来源', exact=True).count() == 0
    assert page.get_by_role('checkbox').count() == 0
    assert page.locator('.model-library:not([hidden]) [data-model-id]').count() == 0
    search = page.get_by_role('searchbox', name='搜索模型', exact=True)
    card = category_card(page, 'bottle')
    card.wait_for()
    wait_listing(page, full_page=False)
    card.scroll_into_view_if_needed()
    position = scroll_positions(page)
    with page.expect_response(lambda r: urlparse(r.url).path == '/api/model-library' and
        parse_qs(urlparse(r.url).query).get('exact_category') == ['bottle']) as response:
        card.click()
    result = response.value.json()
    wait_listing(page, full_page=False)
    assert {item['category'] for item in result['items']} == {'bottle'}
    assert page.locator('.model-library:not([hidden]) [data-category]').count() == 0
    source = page.get_by_role('button', name='来源', exact=True)
    source.click()
    menu = page.get_by_role('listbox', name='来源', exact=True)
    assert menu.get_by_role('option').count() == len(result['sources']) + 1
    assert menu.evaluate('el => getComputedStyle(el).overflowY') == 'auto'
    box = menu.bounding_box()
    assert box['height'] <= 320 and box['width'] <= width
    page.screenshot(path=str(out / f'category-models-{width}-{theme}.png'))
    source_key = result['sources'][0]['source']
    with page.expect_response(lambda r: urlparse(r.url).path == '/api/model-library' and
        parse_qs(urlparse(r.url).query).get('source') == [source_key]) as filtered:
        menu.get_by_role('option').nth(1).click()
    scoped = filtered.value.json()
    wait_listing(page, full_page=False)
    assert {item['source'] for item in scoped['items']} == {source_key}
    assert {item['category'] for item in scoped['items']} == {'bottle'}
    assert scoped['sources'] == result['sources']
    page.get_by_role('searchbox', name='搜索模型', exact=True).fill('no-such-model-1937')
    page.get_by_text('没有匹配的模型', exact=True).wait_for()
    page.get_by_role('button', name='返回全部类别', exact=True).click()
    wait_listing(page, full_page=False)
    assert search.input_value() == ''
    assert card.evaluate('el => el === document.activeElement'), ('category focus not restored', card.evaluate('''el => ({
      active: document.activeElement?.outerHTML.slice(0, 500), disabled: el.disabled,
      clip: getComputedStyle(el.closest('.model-library-results')).clipPath,
      position: el.getBoundingClientRect().toJSON()})'''))
    assert scroll_positions(page) == position, ('category scroll not restored', position, scroll_positions(page))
    search.fill('no-such-model-1937')
    page.get_by_text('没有匹配的模型', exact=True).wait_for()
    search.fill('')
    wait_listing(page)


def check_library_controls(page, out):
    def scroll_library(offset):
        page.locator('.content-scroll').evaluate('''(el, y) => {
          if (getComputedStyle(el).overflowY === 'visible') {
            window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + y);
          } else el.scrollTop = y;
        }''', offset)

    def check_sticky():
        for offset in [0, 380, 900]:
            scroll_library(offset)
            page.wait_for_timeout(100)
            state = page.locator('.model-library:not([hidden]) .model-library-toolbar').evaluate('''el => {
              const bounds = el.getBoundingClientRect();
              const root = el.closest('.content-scroll');
              const documentScroll = getComputedStyle(root).overflowY === 'visible';
              const search = el.querySelector('input');
              const box = search.getBoundingClientRect();
              return {top: bounds.top, rootTop: documentScroll ? 0 : root.getBoundingClientRect().top,
                bottom: bounds.bottom, rootBottom: documentScroll ? innerHeight : root.getBoundingClientRect().bottom,
                scroll: documentScroll ? -root.getBoundingClientRect().top : root.scrollTop,
                searchOnTop: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === search,
                faded: root.classList.contains('fade-top'),
                height: bounds.height,
                scrollMargin: parseFloat(getComputedStyle(el.closest('section').querySelector('.model-card')).scrollMarginTop)};
            }''')
            assert abs(state['top'] - state['rootTop']) <= (1 if offset else 5), state
            assert abs(state['scroll'] - offset) < 1, ('did not scroll', state, offset)
            assert state['bottom'] < state['rootBottom'] and state['searchOnTop'], state
            assert not state['faded'] and state['scrollMargin'] >= state['height'] + 11, state

    def check_badges(result):
        wait_listing(page, full_page=False)
        cards = page.locator('.model-library:not([hidden]) [data-model-id]')
        actual = cards.evaluate_all('''items => items.map(el => ({id: el.dataset.modelId,
          badge: !!el.querySelector('.model-kind-badge'), label: el.getAttribute('aria-label')}))''')
        expected = {item['id']: item['kind'] == 'articulated' for item in result['items']}
        assert {item['id']: item['badge'] for item in actual} == expected
        assert all('关节模型' in item['label'] for item in actual if item['badge'])

    for width, height in [(1440, 1000), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        wait_listing(page)
        assert page.locator('.model-library:not([hidden]) .model-kind-badge').count() == 0
        for theme in ['light', 'dark']:
            set_theme(page, theme)
            check_sticky()
            page.screenshot(path=str(out / f'sticky-categories-{width}-{theme}.png'))

        search = page.get_by_role('searchbox', name='搜索模型', exact=True)
        card = category_card(page, 'bottle')
        with page.expect_response(lambda r: urlparse(r.url).path == '/api/model-library' and
                parse_qs(urlparse(r.url).query).get('exact_category') == ['bottle']) as response:
            card.click()
        check_badges(response.value.json())
        for source_key, source_label in [('robocasa', 'RoboCasa'), ('partnet', 'PartNet-Mobility')]:
            page.get_by_role('button', name='来源', exact=True).click()
            with page.expect_response(lambda r: urlparse(r.url).path == '/api/model-library' and
                    parse_qs(urlparse(r.url).query).get('source') == [source_key]) as response:
                page.get_by_role('listbox', name='来源', exact=True).get_by_role('option').filter(has_text=source_label).click()
            check_badges(response.value.json())
            assert bool(page.locator('.model-library:not([hidden]) .model-kind-badge').count()) == (source_key == 'partnet')

        for theme in ['light', 'dark']:
            set_theme(page, theme)
            check_sticky()
            page.get_by_role('button', name='来源', exact=True).click()
            menu = page.get_by_role('listbox', name='来源', exact=True)
            assert menu.evaluate('''el => {
              const rect = el.getBoundingClientRect();
              return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + 20));
            }'''), 'source menu obscured by cards'
            page.screenshot(path=str(out / f'sticky-models-{width}-{theme}.png'))
            page.keyboard.press('Escape')
            scroll_library(0)
            badge = page.locator('.model-library:not([hidden]) .model-kind-badge').first
            badge.hover()
            page.wait_for_function('''() => getComputedStyle(document.querySelector('.model-library:not([hidden]) .model-kind-tooltip')).opacity === '1' ''')
            page.screenshot(path=str(out / f'articulated-badge-{width}-{theme}.png'))
            card = page.locator('.model-library:not([hidden]) .model-card').first
            page.mouse.move(1, 1)
            card.focus()
            page.keyboard.press('Tab')
            page.keyboard.press('Shift+Tab')
            assert card.locator('.model-kind-tooltip').is_visible(), 'keyboard tooltip missing'
        page.get_by_role('button', name='返回全部类别', exact=True).click()
        search.fill('')
        wait_listing(page)
        scroll_library(0)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    set_theme(page, 'light')
    wait_listing(page)
    return {'sticky_categories_and_models': True, 'source_menu_above_cards': True,
            'articulated_badges_only': True, 'hover_and_keyboard_tooltips': True,
            'responsive_scroll_margin': True, 'mobile_desktop_light_dark': True}


def check_card_tilt(page, out):
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.emulate_media(reduced_motion='no-preference')
    wait_listing(page)
    card = page.locator('.model-library:not([hidden]) .model-card').nth(1)
    card.scroll_into_view_if_needed()
    surface = card.locator('.model-card-surface')
    for theme in ['light', 'dark']:
        set_theme(page, theme)
        card.scroll_into_view_if_needed()
        bounds = card.bounding_box()
        layout = card.evaluate('el => [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]')
        lighting = []
        for x, y, name in [(.15, .15, 'upper-left'), (.85, .85, 'lower-right')]:
            page.mouse.move(bounds['x'] + bounds['width'] * x, bounds['y'] + bounds['height'] * y, steps=6)
            page.wait_for_function('''() => {
              const el = document.querySelector('.model-card-surface[data-tilting="true"]');
              return el && getComputedStyle(el).transform.startsWith('matrix3d(') &&
                getComputedStyle(el).backgroundImage.includes('linear-gradient');
            }''')
            page.wait_for_timeout(180)
            page.wait_for_function('''el => {
              const sheen = getComputedStyle(el);
              return Math.abs(parseFloat(sheen.backgroundPositionX) - parseFloat(el.style.getPropertyValue('--card-light-x'))) < .2 &&
                Math.abs(parseFloat(sheen.backgroundPositionY) - parseFloat(el.style.getPropertyValue('--card-light-y'))) < .2;
            }''', arg=surface.element_handle())
            angles = surface.evaluate('el => [parseFloat(el.style.getPropertyValue("--card-rotate-x")), parseFloat(el.style.getPropertyValue("--card-rotate-y"))]')
            assert all(3 < abs(value) <= 7 for value in angles), angles
            assert (angles[0] > 0) == (y < .5) and (angles[1] > 0) == (x > .5)
            transform = surface.evaluate('el => getComputedStyle(el).transform')
            assert transform.startswith('matrix3d('), (transform, surface.get_attribute('style'), surface.get_attribute('data-tilting'))
            reflection = surface.evaluate('''el => {
              const sheen = getComputedStyle(el);
              return {position: sheen.backgroundPosition,
                image: sheen.backgroundImage, overlay: getComputedStyle(el, '::after').content,
                shadow: getComputedStyle(el).boxShadow};
            }''')
            assert 'linear-gradient' in reflection['image']
            assert reflection['overlay'] == 'none' and reflection['shadow'] != 'none'
            lighting.append(reflection)
            # Scroll settling can move viewport coordinates, but never the layout box.
            assert card.evaluate('el => [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]') == layout, 'tilt moved its own hit area'
            assert page.locator('.model-library:not([hidden])').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
            page.screenshot(path=str(out / f'card-tilt-{name}-{theme}.png'))
        assert lighting[0]['position'] != lighting[1]['position'], ('highlight did not follow pointer', lighting)
        assert lighting[0]['shadow'] != lighting[1]['shadow'], 'shadow did not follow pointer'
        page.mouse.move(1, 1)
        page.wait_for_function('''() => [...document.querySelectorAll('.model-card-surface')]
          .every(el => !el.hasAttribute('data-tilting') && getComputedStyle(el).transform === 'none' &&
            getComputedStyle(el).backgroundImage === 'none')''')
        assert surface.get_attribute('data-tilting') is None
        assert surface.evaluate('el => getComputedStyle(el).transform') == 'none'
    page.mouse.move(bounds['x'] + 25, bounds['y'] + 25)
    page.wait_for_function('document.querySelector(".model-card-surface[data-tilting]") !== null')
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('document.querySelector(".model-card-surface[data-tilting]") === null')
    page.mouse.move(bounds['x'] + 40, bounds['y'] + 40)
    assert surface.evaluate('el => getComputedStyle(el).transform') == 'none'
    assert surface.evaluate('el => getComputedStyle(el).backgroundImage') == 'none'
    page.emulate_media(reduced_motion='no-preference')
    page.mouse.move(1, 1)
    card.dispatch_event('pointermove', {'pointerType': 'touch', 'clientX': bounds['x'] + 20, 'clientY': bounds['y'] + 20})
    page.wait_for_timeout(50)
    assert surface.get_attribute('data-tilting') is None, 'touch input triggered tilt'
    card.focus()
    page.keyboard.press('Tab')
    page.keyboard.press('Shift+Tab')
    assert card.evaluate('el => el === document.activeElement')
    assert card.evaluate('el => el.matches(":focus-visible")'), 'keyboard focus indication lost'
    assert card.evaluate('el => getComputedStyle(el).userSelect') == 'none'
    set_theme(page, 'light')
    return {'card_tilt': True, 'pointer_lighting': True, 'stable_hit_area': True, 'reset': True, 'reduced_motion': True,
            'touch_guard': True, 'nonselectable_labels': True, 'editable_search': True}


def check_thumbnail_hover_pixels(page, out, card, name):
    card.scroll_into_view_if_needed()
    counts = []
    for theme in ['light', 'dark']:
        set_theme(page, theme)
        bounds = card.bounding_box()
        for x, y, corner in [(.2, .2, 'upper-left'), (.8, .8, 'lower-right')]:
            page.mouse.move(bounds['x'] + bounds['width'] * x, bounds['y'] + bounds['height'] * y, steps=6)
            page.wait_for_function('''el => el.querySelector('.model-card-surface').dataset.tilting === 'true'
                && getComputedStyle(el.querySelector('.model-card-surface')).backgroundImage.includes('linear-gradient')''',
                arg=card.element_handle())
            frame = card.screenshot(path=str(out / f'{name}-hover-{theme}-{corner}.png'))
            image = Image.open(io.BytesIO(frame)).convert('RGB')
            # Fixture images are blue/green; a painted card background must not pass.
            colored = sum(g > r * 1.5 and b > r * 1.5 and g > 65 and b > 65
                          for r, g, b in image.getdata())
            assert colored > image.width * image.height * .35, (name, theme, corner, colored)
            counts.append(colored)
    page.mouse.move(1, 1)
    return {'card': name, 'visible_thumbnail_pixels': counts}


def check_object_taxonomy(page, out):
    def filter_query(control, value, path):
        with page.expect_response(lambda response: urlparse(response.url).path == path and
                parse_qs(urlparse(response.url).query).get('q', ['']) == [value]):
            control.fill(value)
        wait_listing(page, full_page=False)
    category_card(page, 'bags').click()
    wait_listing(page, full_page=False)
    filter_query(page.get_by_role('searchbox', name='搜索模型'), '笔袋 粉色', '/api/model-library')
    horse = page.locator('[data-model-id="gso_horses_in_pink_pencil_case_3589bc32"]')
    horse.wait_for()
    assert page.locator('.model-library:not([hidden]) [data-model-id]').count() == 2
    horse.click()
    metadata = page.locator('.model-metadata')
    metadata.get_by_text('细分类型', exact=True).wait_for()
    for label in ['笔袋', '粉色', '马图案']:
        assert metadata.get_by_text(label, exact=True).count() == 1
    for width, height in [(1440, 1000), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        for theme in ['light', 'dark']:
            set_theme(page, theme)
            assert metadata.evaluate('el => el.scrollWidth <= el.clientWidth + 1')
            metadata.scroll_into_view_if_needed()
            metadata.screenshot(path=str(out / f'taxonomy-attributes-{width}-{theme}.png'))
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.get_by_role('button', name='返回模型列表', exact=True).click()
    page.get_by_role('button', name='返回全部类别', exact=True).click()
    wait_listing(page, full_page=False)
    category_card(page, 'needs_review').click()
    wait_listing(page, full_page=False)
    assert page.locator('.model-library:not([hidden]) [data-model-id]').count() == 2
    page.locator('[data-model-id="gso_prosport_harness_to_booster_seat_df164210"]').click()
    metadata.get_by_text('待核对原因', exact=True).wait_for()
    assert '盘装食物' in metadata.inner_text()
    assert metadata.get_by_text('品牌', exact=True).count() == 0
    metadata.screenshot(path=str(out / 'taxonomy-needs-review.png'))
    page.get_by_role('button', name='返回模型列表', exact=True).click()
    page.get_by_role('button', name='返回全部类别', exact=True).click()
    wait_listing(page, full_page=False)
    return {'subtype_search': True, 'separate_attributes': True, 'needs_review_reason': True,
            'metadata_mobile_and_themes': True}


def check_carousel_lifecycle(page, out):
    # Controlled image responses isolate lifecycle checks from the server render queue.
    items = [
        {'category': 'qa-carousel', 'count': 3, 'stored': 3, 'previews': {
            'items': [{'id': 'qa_a', 'label': 'First'}, {'id': 'qa_bad', 'label': 'Broken'}], 'offset': 0, 'total': 3}},
        {'category': 'qa-single', 'count': 1, 'stored': 1, 'previews': {
            'items': [{'id': 'qa_single', 'label': 'Single'}], 'offset': 0, 'total': 1}},
        {'category': 'qa-missing', 'count': 1, 'stored': 0, 'previews': {'items': [], 'offset': 0, 'total': 0}},
    ]
    requests = []
    preview_offsets = []
    empty = False
    def listing(route):
        params = parse_qs(urlparse(route.request.url).query)
        selected = [] if empty else items
        route.fulfill(json={'items': selected, 'total': len(selected), 'indexed': 5, 'stored': 4,
                            'page': 1, 'page_size': int(params['page_size'][0])})
    def previews(route):
        offset = int(parse_qs(urlparse(route.request.url).query)['offset'][0])
        preview_offsets.append(offset)
        result = [{'id': 'qa_b', 'label': 'Second'}] if offset == 2 else items[0]['previews']['items']
        route.fulfill(json={'items': result, 'offset': offset, 'total': 3})
    def thumbnail(route):
        asset_id = urlparse(route.request.url).path.split('/')[-2]
        requests.append(asset_id)
        if asset_id == 'qa_bad':
            route.fulfill(json={'status': 'failed', 'detail': 'QA failure'})
        else:
            image = Image.new('RGBA', (480, 360), (0, 0, 0, 0))
            ImageDraw.Draw(image).rounded_rectangle((20, 20, 460, 340), radius=18,
                fill='#1677aa' if asset_id == 'qa_a' else '#28a978')
            output = io.BytesIO()
            image.save(output, format='WEBP')
            route.fulfill(content_type='image/webp', body=output.getvalue())
    page.route('**/api/model-library/categories?*', listing)
    page.route('**/api/model-library/category-previews?*', previews)
    page.route('**/api/model-library/qa_*/thumbnail', thumbnail)
    page.evaluate('''() => {
      window.qaUrls = new Set();
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.qaUrls.add(url); return url; };
      URL.revokeObjectURL = url => { window.qaUrls.delete(url); revoke(url); };
    }''')
    page.get_by_role('button', name='刷新模型仓库', exact=True).click()
    wait_listing(page, full_page=False)
    card = page.locator('[data-category="qa-carousel"]')
    card.wait_for()
    card.scroll_into_view_if_needed()
    page.wait_for_function('document.querySelector("[data-preview-id=qa_a].is-current")?.naturalWidth === 480')
    page.wait_for_function('''() => document.querySelector('[data-preview-id=qa_b]:not(.is-current)')?.naturalWidth === 480 &&
        !!document.querySelector('[data-preview-id=qa_a].is-current')''', timeout=5000, polling=30)
    page.wait_for_function('''() => {
      const image = document.querySelector('[data-preview-id=qa_b].is-current');
      return image && +getComputedStyle(image).opacity > .05 && +getComputedStyle(image).opacity < .95;
    }''', timeout=20000, polling=30)
    assert card.locator('img').count() == 2, 'crossfade did not retain outgoing image'
    page.wait_for_function('document.querySelector("[data-category=qa-carousel]").querySelectorAll("img").length === 1')
    assert requests.count('qa_single') == 1
    assert 'qa_bad' in requests and 2 in preview_offsets
    assert page.locator('[data-category="qa-missing"] img').count() == 0
    assert page.evaluate('window.qaUrls.size') <= 3
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(200)
    count = len(requests)
    frame = card.locator('img').get_attribute('data-preview-id')
    page.wait_for_timeout(5000)
    assert len(requests) == count and card.locator('img').get_attribute('data-preview-id') == frame
    page.emulate_media(reduced_motion='no-preference')
    page.evaluate('''() => {
      Object.defineProperty(document, 'hidden', {configurable: true, value: true});
      document.dispatchEvent(new Event('visibilitychange'));
    }''')
    page.wait_for_timeout(200)
    count = len(requests)
    page.wait_for_timeout(5000)
    assert len(requests) == count, 'hidden tab continued fetching'
    page.evaluate('''() => {
      delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));
      document.querySelector('.model-grid').style.marginTop = '2000px';
    }''')
    page.wait_for_timeout(300)
    count = len(requests)
    page.wait_for_timeout(5000)
    assert len(requests) == count, 'offscreen carousel continued fetching'
    page.evaluate('document.querySelector(".model-grid").style.marginTop = ""')
    hover = []
    for category in ['qa-single', 'qa-carousel']:
        card = page.locator(f'[data-category="{category}"]')
        page.wait_for_function('''el => [...el.querySelectorAll('img')].some(img =>
            img.naturalWidth === 480 && +getComputedStyle(img).opacity > .95)''', arg=card.element_handle())
        hover.append(check_thumbnail_hover_pixels(page, out, card, category))
    # The same card surface hosts individual model thumbnails without carousel opacity.
    single = page.locator('[data-category="qa-single"]')
    single.locator('.model-category-preview').evaluate("el => el.classList.remove('model-category-preview')")
    hover.append(check_thumbnail_hover_pixels(page, out, single, 'qa-individual'))
    empty = True
    page.get_by_role('button', name='刷新模型仓库', exact=True).click()
    page.get_by_text('没有匹配的类别', exact=True).wait_for()
    assert page.evaluate('window.qaUrls.size') == 0, 'unmounted carousel leaked blob URLs'
    page.unroute('**/api/model-library/categories?*', listing)
    page.unroute('**/api/model-library/category-previews?*', previews)
    page.unroute('**/api/model-library/qa_*/thumbnail', thumbnail)
    return {'crossfade': True, 'advance_preload': True, 'preview_paging': True, 'broken_image_skip': True, 'singleton_static': True,
            'reduced_motion_pause': True, 'hidden_pause': True, 'offscreen_pause': True, 'blob_cleanup': True,
            'hover_thumbnail_pixels': hover}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--online', action='store_true')
    parser.add_argument('--cloud-resources', action='store_true', help='Test local code with cloud-hosted meshes')
    parser.add_argument('--asset', action='append', help='Limit viewer checks to these model IDs')
    parser.add_argument('--output', type=Path, help='Directory for screenshots and QA results')
    parser.add_argument('--skip-layout', action='store_true')
    parser.add_argument('--cards-only', action='store_true', help='Check card layout, hover pixels and carousel lifecycle')
    parser.add_argument('--taxonomy', action='store_true', help='Check reviewed subtypes, attributes and ambiguous identities')
    parser.add_argument('--controls', action='store_true', help='Check articulated badges and sticky library controls')
    parser.add_argument('--search', action='store_true', help='Check scoped model search and detail navigation')
    args = parser.parse_args()
    out = args.output or ROOT / ('build/model-library-online-qa' if args.online else 'build/model-library-qa')
    out.mkdir(parents=True, exist_ok=True)
    library = ModelLibrary(ROOT / 'build/model-library-local', Path(r'E:\Desktop\123\code_1015\shared\assets\catalog'))
    app = FastAPI()
    app.include_router(create_model_router(library))
    app.mount('/', StaticFiles(directory=ROOT / 'frontend/dist', html=True))
    port = 28749
    server = thread = None
    credentials = None
    if args.online or args.cloud_resources:
        credentials = json.loads((Path.home() / '.config/telebot-model-library.json').read_text(encoding='utf-8'))
    if args.online:
        base = credentials['base_url']
    else:
        server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=port, log_level='error'))
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        while not server.started:
            if not thread.is_alive():
                raise RuntimeError('QA server failed to start')
            time.sleep(.1)
        base = f'http://127.0.0.1:{port}'
    report = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CLOUD_CONSOLE_CHROMIUM_PATH'),
                args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            page = browser.new_page(viewport={'width': 1440, 'height': 1000})
            errors = []
            resource_requests = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            status = {'connected': True, 'ssh_target': 'ubuntu@model-qa', 'public_base_url': base,
                'ingest_mode': 'p2p', 'pending_offers': 0, 'service_running_count': '0', 'health_ok_count': '0',
                'last_refresh': 'now', 'summary_status': 'test', 'config_path': '', 'services': [], 'health_checks': [],
                'port_checks': [], 'network_snapshot': {'local': {'ip': '-'}, 'server': {'ip': '-'}}}
            def intercept(route):
                url = route.request.url
                if url.startswith(('blob:', 'data:')):
                    route.continue_()
                    return
                if not url.startswith(base + '/'):
                    route.abort()
                    return
                path = urlparse(url).path
                if credentials and path.startswith('/api/model-library'):
                    headers = {**route.request.headers, 'X-Model-Library-Token': credentials['token']}
                    is_resource = path.endswith(('/view', '/file', '/manifest', '/thumbnail'))
                    if is_resource:
                        resource_requests.append(path)
                    if args.online:
                        route.continue_(headers=headers)
                        return
                    if is_resource:
                        response = route.fetch(url=credentials['base_url'] + url[len(base):], headers=headers, timeout=120000)
                        route.fulfill(response=response)
                        return
                if not path.startswith('/api/') or path.startswith('/api/model-library'):
                    route.continue_()
                    return
                body = {}
                if path == '/api/access':
                    body = {'webMode': True, 'authenticated': True, 'username': 'qa', 'admin': True, 'role': 'admin'}
                elif path in {'/api/status', '/api/status/live'}:
                    body = status
                route.fulfill(content_type='application/json', body=json.dumps(body))
            page.route('**/*', intercept)
            page.add_init_script("sessionStorage.setItem('cloud-service-console.account-session','test');")
            page.goto(base)
            page.get_by_role('button', name='模型仓库', exact=True).click()
            page.locator('.model-library:not([hidden]) .model-card').first.wait_for()
            page.wait_for_function('''() => [...document.querySelectorAll('.model-library:not([hidden]) .model-card')].slice(0, 3)
              .every(el => { const img = el.querySelector('img'); return img?.complete && img.naturalWidth >= 400; })''', timeout=180000)
            assert page.locator('.model-library canvas').count() == 0, 'list created WebGL contexts'
            if args.taxonomy:
                report.append(check_object_taxonomy(page, out))
                print(json.dumps(report[-1]), flush=True)
            if args.controls:
                report.append(check_library_controls(page, out))
                print(json.dumps(report[-1]), flush=True)
            if args.search:
                report.append(check_model_search(page, out))
                print(json.dumps(report[-1]), flush=True)
            if not args.skip_layout:
                report.append(check_library_layout(page, out))
                print(json.dumps(report[-1]), flush=True)
                report.append(check_card_tilt(page, out))
                print(json.dumps(report[-1]), flush=True)
            page.screenshot(path=str(out / 'library-desktop.png'), full_page=True)
            examples = ['gso_11pro_sl_trx_fg_4f03f643', 'rc_aigen_objs_alcohol_alcohol_0_4b87a281', 'partnet_7119', 'robosuite_milk']
            for asset_id in ([] if args.cards_only else args.asset or examples):
                if args.online:
                    request = urllib.request.Request(base + '/api/model-library/' + quote(asset_id, safe=''),
                        headers={'X-Model-Library-Token': credentials['token']})
                    with urllib.request.urlopen(request, timeout=120) as response:
                        category = json.load(response)['category']
                else:
                    category = library.get(asset_id)['category']
                category_card(page, category).click()
                wait_listing(page, full_page=False)
                page.get_by_role('searchbox', name='搜索模型').fill(asset_id)
                card = page.locator(f'.model-library:not([hidden]) .model-card[data-model-id="{asset_id}"]')
                card.wait_for()
                card.locator('img').wait_for(timeout=180000)
                page.wait_for_function('(id) => { const img = document.querySelector(`[data-model-id="${id}"] img`); return img?.complete && img.naturalWidth === 480; }', arg=asset_id)
                card.screenshot(path=str(out / f'{asset_id}-card.png'))
                card.click()
                page.locator('.model-viewport canvas').wait_for()
                page.wait_for_function("!document.querySelector('.model-viewport-status') || !!document.querySelector('.model-viewport-error')", timeout=120000)
                error = page.locator('.model-viewport-error')
                if error.count():
                    raise AssertionError(asset_id + ': ' + error.inner_text())
                canvas = page.locator('.model-viewport canvas')
                assert page.locator('.model-viewport-shell').evaluate('''el => {
                    const css = getComputedStyle(el);
                    return parseFloat(css.borderTopLeftRadius) >= 8 && css.overflow === 'hidden';
                }'''), 'viewer is not clipped to a rounded rectangle'
                before = canvas_png(canvas)
                (out / f'{asset_id}-initial.png').write_bytes(before)
                image = Image.open(io.BytesIO(before)).convert('RGB')
                colors = image.resize((120, 100)).getcolors(12000) or []
                assert len(colors) > 40, (asset_id, 'blank canvas', len(colors))
                floor = image.crop((0, int(image.height * .84), image.width, image.height)).resize((100, 20))
                assert len(floor.getcolors(2000) or []) > 4, (asset_id, 'reference grid missing below model')
                canvas.evaluate('el => el.dataset.qaIdentity = "loaded"')
                count = len(resource_requests)
                set_theme(page, 'dark')
                dark_image = Image.open(io.BytesIO(canvas_png(canvas))).convert('RGB')
                assert sum(image.getpixel((5, 5))) - sum(dark_image.getpixel((5, 5))) > 300
                assert len(resource_requests) == count, 'theme switch refetched model'
                assert canvas.get_attribute('data-qa-identity') == 'loaded', 'theme recreated canvas'
                page.locator('.model-detail').screenshot(path=str(out / f'{asset_id}-dark.png'))
                set_theme(page, 'light')
                restored = canvas_png(canvas)
                (out / f'{asset_id}-restored.png').write_bytes(restored)
                assert before == restored, 'theme switch reset camera or changed materials'
                box = canvas.bounding_box()
                page.mouse.move(box['x'] + box['width']*.55, box['y'] + box['height']*.5)
                page.mouse.down()
                page.mouse.move(box['x'] + box['width']*.7, box['y'] + box['height']*.55, steps=8)
                page.mouse.up()
                after = canvas_png(canvas)
                assert before != after, (asset_id, 'rotation did not change image')
                page.get_by_role('button', name='放大', exact=True).click()
                assert after != canvas_png(canvas), (asset_id, 'zoom did not change image')
                page.get_by_role('button', name='恢复视角', exact=True).click()
                stationary = canvas_png(canvas)
                page.get_by_role('button', name='自动旋转', exact=True).click()
                page.wait_for_timeout(250)
                assert stationary != canvas_png(canvas), (asset_id, 'auto rotation did not move')
                page.get_by_role('button', name='自动旋转', exact=True).click()
                page.get_by_role('button', name='恢复视角', exact=True).click()
                page.locator('.model-detail').screenshot(path=str(out / f'{asset_id}.png'))
                page.set_viewport_size({'width': 390, 'height': 844})
                canvas.screenshot(path=str(out / f'{asset_id}-mobile.png'))
                set_theme(page, 'dark')
                canvas.screenshot(path=str(out / f'{asset_id}-mobile-dark.png'))
                set_theme(page, 'light')
                size = canvas.bounding_box()
                assert size['width'] >= 150 and size['height'] >= 300
                assert page.locator('.model-detail').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
                page.set_viewport_size({'width': 1440, 'height': 1000})
                page.get_by_role('button', name='返回模型列表', exact=True).click()
                wait_listing(page, full_page=False)
                assert page.get_by_role('searchbox', name='搜索模型').input_value() == asset_id
                page.get_by_role('button', name='返回全部类别', exact=True).click()
                wait_listing(page, full_page=False)
                report.append({'id': asset_id, 'colors': len(colors), 'rotation': True, 'zoom': True, 'mobile': True, 'themes': True})
                print(json.dumps(report[-1]), flush=True)
            page.get_by_role('searchbox', name='搜索模型').fill('no-such-model-test-9182')
            page.get_by_text('没有匹配的模型', exact=True).wait_for()
            page.get_by_role('button', name='返回全部类别', exact=True).click()
            wait_listing(page)
            report.append(check_carousel_lifecycle(page, out))
            print(json.dumps(report[-1]), flush=True)
            assert not errors, errors
            browser.close()
        (out / 'report.json').write_text(json.dumps(report, indent=2))
    finally:
        if server:
            server.should_exit = True
            thread.join(timeout=15)


if __name__ == '__main__':
    main()
