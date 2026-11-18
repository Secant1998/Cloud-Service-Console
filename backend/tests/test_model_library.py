import hashlib
import io
import json
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from model_library import ModelLibrary, create_model_router, resolve_category_overrides, safe_relative


@pytest.fixture
def library(tmp_path):
    root = tmp_path / 'catalog'
    asset = root / 'cup'
    asset.mkdir(parents=True)
    (asset / 'model.obj').write_text('mtllib material.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')
    (asset / 'material.mtl').write_text('newmtl white\nKd 1 1 1\nmap_Kd texture.png\n')
    (asset / 'texture.png').write_bytes(b'fixture-texture')
    door = root / 'door'
    door.mkdir()
    (door / 'part.obj').write_text('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')
    (door / 'mobility.urdf').write_text('''<robot name="test"><link name="base"/>
      <link name="door"><visual><origin xyz="0 0 1"/><geometry><mesh filename="part.obj"/></geometry></visual></link>
      <joint name="hinge" type="revolute"><parent link="base"/><child link="door"/>
        <origin xyz="1 2 3" rpy="0 0 1.57"/><axis xyz="0 0 1"/><limit lower="0" upper="1.57"/></joint></robot>''')
    entries = [
        {'id': 'test_cup', 'label': 'Cup 100%', 'tags': ['cup'], 'source': 'RoboCasa / aigen_objs', 'kind': 'mesh', 'mesh': 'cup/model.obj'},
        {'id': 'test_door', 'label': 'Door', 'tags': ['door'], 'category': 'Door', 'source': 'PartNet-Mobility / SAPIEN official',
         'kind': 'articulated', 'descriptor_format': 'urdf', 'local_descriptor': 'door/mobility.urdf'},
        {'id': 'test_missing', 'label': 'Not downloaded', 'source': 'robosuite', 'downloaded': False},
    ]
    (root / 'index.json').write_text(json.dumps(entries))
    store = ModelLibrary(tmp_path)
    assert store.build()['models'] == 3
    return store


def test_search_pagination_and_literal_wildcards(library):
    result = library.list(page_size=2)
    assert result['total'] == 3 and result['stored'] == 2
    assert len(result['items']) == 2
    assert library.list(query='%')['total'] == 1
    assert library.list(query='_')['total'] == 3
    assert library.list(source='partnet')['items'][0]['id'] == 'test_door'
    assert library.list(query='nothing')['total'] == 0


def test_materials_and_assembled_urdf(library):
    cup = library.view('test_cup')
    assert cup['parts'][0]['materials'] == [{'file': 'cup/material.mtl', 'textures': {'texture.png': 'cup/texture.png'}}]
    door = library.view('test_door')
    node = next(n for n in door['nodes'] if n['name'] == 'door')
    assert node['parent'] == 'base' and node['xyz'] == [1, 2, 3]
    assert door['parts'][0]['node'] == 'door'
    assert door['parts'][0]['xyz'] == [0, 0, 1]
    assert door['joints'] == [{'name': 'hinge', 'type': 'revolute', 'parent': 'base', 'child': 'door',
                              'axis': [0, 0, 1], 'lower': 0, 'upper': 1.57}]
    assert cup['joints'] == []


def test_libero_source_and_native_texture(library):
    import xml.etree.ElementTree as ET
    from model_library import source_key
    assert source_key({'source':'LIBERO / stable_scanned_objects'}) == 'libero'
    descriptor=library.catalog/'door/mobility.urdf'
    xml=ET.parse(descriptor)
    visual=xml.getroot().find("link[@name='door']/visual")
    material=ET.SubElement(visual,'material',name='paint')
    ET.SubElement(material,'texture',filename='paint.png')
    (descriptor.parent/'paint.png').write_bytes(b'preview')
    xml.write(descriptor)
    library.build()
    assert library.view('test_door')['parts'][0]['texture']=='door/paint.png'


@pytest.mark.parametrize('mass,center,valid', [('2.5', '1 2 3', True), ('None', '1 2 3', False), ('1', '0 None 0', False)])
def test_optional_inertia_for_joint_marker(library, mass, center, valid):
    import xml.etree.ElementTree as ET
    descriptor = library.catalog / 'door/mobility.urdf'
    xml = ET.parse(descriptor)
    link = next(link for link in xml.getroot().findall('link') if link.get('name') == 'door')
    inertia = ET.SubElement(link, 'inertial')
    ET.SubElement(inertia, 'mass', value=mass)
    ET.SubElement(inertia, 'origin', xyz=center)
    xml.write(descriptor)
    node = next(node for node in library.view('test_door')['nodes'] if node['name'] == 'door')
    if valid:
        assert node['mass'] == 2.5 and node['center_of_mass'] == [1, 2, 3]
    else:
        assert 'mass' not in node and 'center_of_mass' not in node


def test_compiled_robocasa_texture_policy_is_scoped_and_cache_specific(library, monkeypatch):
    import model_thumbnails
    from model_library import uses_compiled_texture_uv
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    compiled = dict(entries[0], id='compiled', source='RoboCasa / objaverse', normalizer_version=1,
                    local_import={'complete': True}, parameters={'geometry': {'source': 'MuJoCo compiled source geometry'}},
                    visual_parts=[{'mesh': 'cup/model.obj', 'texture': 'cup/texture.png'}])
    entries += [compiled, dict(compiled, id='future_version', normalizer_version=2),
                dict(compiled, id='native_gso', source='Google Scanned Objects'),
                dict(compiled, id='unverified_import', local_import={'complete': False}),
                dict(compiled, id='native_geometry', parameters={'geometry': {'source': 'native mesh'}}),
                dict(compiled, id='untextured', visual_parts=[{'mesh': 'cup/model.obj'}])]
    index.write_text(json.dumps(entries))
    library.build()
    manifests = {entry['id']: library.manifest(entry['id']) for entry in entries}
    with monkeypatch.context() as patch:
        patch.setattr(model_thumbnails, 'texture_preview_revision', lambda _: '')
        old = {entry['id']: model_thumbnails.ThumbnailCache(library).target(entry['id'])
               for entry in entries if entry['id'] != 'test_missing'}
    assert uses_compiled_texture_uv(compiled)
    for entry in entries:
        asset_id = entry['id']
        if asset_id == 'test_missing':
            continue
        part = library.view(asset_id)['parts'][0]
        if asset_id == 'compiled':
            assert part['texture_flip_y'] is False
            assert model_thumbnails.ThumbnailCache(library).target(asset_id) != old[asset_id]
        else:
            assert 'texture_flip_y' not in part
            assert model_thumbnails.ThumbnailCache(library).target(asset_id) == old[asset_id]
        assert library.manifest(asset_id) == manifests[asset_id]


def test_categories_merge_case_and_filter_all_spellings(library):
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    for i, category in enumerate(['Bottle', 'bottle', 'BOTTLE', ' bottle ']):
        entries.append({**entries[0], 'id': f'bottle_{i}', 'category': category,
                        'source': 'PartNet-Mobility' if i == 0 else 'RoboCasa'})
    entries.extend([{**entries[0], 'id': 'unicode_one', 'category': 'Stra\u00dfe'},
                    {**entries[0], 'id': 'unicode_two', 'category': 'STRASSE'}])
    index.write_text(json.dumps(entries))
    library.build()
    categories = library.list()['categories']
    assert [c for c in categories if c['category'] == 'bottle'] == [{'category': 'bottle', 'count': 4}]
    assert {'category': 'strasse', 'count': 2} in categories
    for spelling in ['Bottle', 'bottle', 'BOTTLE', ' Bottle ']:
        result = library.list(category=spelling, page_size=2)
        assert result['total'] == 4 and len(result['items']) == 2
        assert {item['category'] for item in result['items']} == {'bottle'}
        second = library.list(category=spelling, page_size=2, page=2)
        assert {item['id'] for item in result['items']}.isdisjoint(item['id'] for item in second['items'])
    scoped = library.list(source='robocasa', category='BOTTLE')
    assert scoped['total'] == 3
    assert {'category': 'bottle', 'count': 3} in scoped['categories']
    assert library.get('bottle_0')['category'] == 'bottle'
    assert library.get('bottle_0')['entry']['category'] == 'Bottle'
    assert library.list(category='stra\u00dfe')['total'] == 2


def test_multiple_categories_union_search_source_and_pagination(library):
    selected = [' CUP ', 'door', 'Cup', '']
    result = library.list(category=selected)
    assert result['total'] == 2
    assert {item['id'] for item in result['items']} == {'test_cup', 'test_door'}
    assert {item['category'] for item in result['items']} == {'cup', 'door'}
    assert library.list(category=selected, source='partnet')['items'][0]['id'] == 'test_door'
    assert library.list(category=selected, query='100%')['items'][0]['id'] == 'test_cup'
    first = library.list(category=selected, page_size=1)
    second = library.list(category=selected, page_size=1, page=2)
    assert first['items'][0]['id'] != second['items'][0]['id']
    assert first['total'] == second['total'] == 2
    assert library.list(category=[])['total'] == 3
    assert library.list(category=['', ' '])['total'] == 3
    assert library.list(category=['does-not-exist'])['total'] == 0
    assert library.list(category=["cup') OR 1=1--"])['total'] == 0


def test_multiple_category_query_parameters(library):
    app = FastAPI()
    app.include_router(create_model_router(library))
    with TestClient(app) as client:
        response = client.get('/api/model-library', params=[('category', 'CUP'), ('category', 'Door'), ('category', 'cup')])
        assert response.status_code == 200
        assert response.json()['total'] == 2
        assert client.get('/api/model-library?category=door').json()['total'] == 1
        assert client.get('/api/model-library?category=').json()['total'] == 3
        assert client.get('/api/model-library', params={'category': 'x' * 121}).status_code == 422
        assert client.get('/api/model-library', params=[('category', 'cup')] * 1001).status_code == 422


def test_category_cards_previews_and_scoped_sources(library):
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    for i in range(14):
        entries.append(dict(entries[0], id=f'bottle_{i:02}', label=f'Bottle {i:02}',
                            category=' Bottle ' if i % 2 else 'BOTTLE',
                            source='PartNet-Mobility' if i < 2 else 'RoboCasa'))
    entries += [dict(entries[2], id='bottle_missing', category='bottle'),
                dict(entries[0], id='literal_category', category='100%_test')]
    index.write_text(json.dumps(entries))
    library.build()
    cards = library.categories()
    assert cards['total'] == 5 and cards['indexed'] == 19 and cards['stored'] == 17
    bottle = next(item for item in cards['items'] if item['category'] == 'bottle')
    assert bottle['count'] == 15 and bottle['stored'] == 14
    previews = bottle['previews']
    assert previews['total'] == 14 and len(previews['items']) == 6
    assert {library.get(item['id'])['source'] for item in previews['items'][:2]} == {'partnet', 'robocasa'}
    all_ids = []
    for offset in [0, 6, 12]:
        chunk = library.category_previews(' BOTTLE ', offset)
        assert chunk['total'] == 14 and chunk['offset'] == offset
        all_ids.extend(item['id'] for item in chunk['items'])
    assert len(all_ids) == len(set(all_ids)) == 14
    assert {library.get(asset_id)['category'] for asset_id in all_ids} == {'bottle'}
    assert library.category_previews('bottle', 14)['items'] == []
    assert library.categories(query='BOttLe')['items'] == [bottle]
    assert library.categories(query='%_')['total'] == 1
    assert library.categories(query="') OR 1=1--")['total'] == 0
    first, second = library.categories(page_size=2), library.categories(page=2, page_size=2)
    assert {r['category'] for r in first['items']}.isdisjoint(r['category'] for r in second['items'])
    missing = next(item for item in cards['items'] if item['category'] == '')
    assert missing['count'] == 1 and missing['previews']['items'] == []
    assert library.list(exact_category='')['items'][0]['id'] == 'test_missing'
    scoped = library.list(exact_category='BOTTLE', source='partnet', query='00')
    assert scoped['total'] == 1
    assert scoped['sources'] == [{'source': 'partnet', 'count': 2}, {'source': 'robocasa', 'count': 12},
                                {'source': 'robosuite', 'count': 1}]
    assert library.list(exact_category='door')['sources'] == [{'source': 'partnet', 'count': 1}]


def test_category_routes_are_bounded_and_before_asset_routes(library):
    app = FastAPI()
    app.include_router(create_model_router(library))
    with TestClient(app) as client:
        response = client.get('/api/model-library/categories?page_size=1&page=2')
        assert response.status_code == 200
        assert response.json()['items'][0]['category'] == 'cup'
        preview = client.get('/api/model-library/category-previews?category=CUP').json()
        assert preview == {'items': [{'id': 'test_cup', 'label': 'Cup 100%'}], 'total': 1, 'offset': 0}
        assert client.get('/api/model-library/category-previews?category=unknown').json()['items'] == []
        assert client.get('/api/model-library?exact_category=').json()['total'] == 1
        for url in ['/categories?page_size=101', '/categories?page=0', '/category-previews',
                    '/category-previews?category=cup&limit=13', '/category-previews?category=cup&offset=-1']:
            assert client.get('/api/model-library' + url).status_code == 422


@pytest.mark.parametrize('path', ['../secret', '/etc/passwd', 'C:/Windows/test', '..\\secret'])
def test_traversal_rejected(library, path):
    with pytest.raises(ValueError):
        library.file(path)


def test_brand_models_split_by_object_and_survive_rebuild(library):
    from model_thumbnails import ThumbnailCache
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    entries += [dict(entries[0], id='brand_cup', category='Brand', label='Brand coffee cup'),
                dict(entries[0], id='brand_door', category='Brand', label='Brand door'),
                dict(entries[0], id='brand_unknown', category='Brand', label='Brand unknown')]
    index.write_text(json.dumps(entries))
    library.build()
    before = {row['id']: library.manifest(row['id']) for row in entries}
    cache = ThumbnailCache(library)
    preview = cache.target('brand_cup')
    overrides = library.root / 'overrides.json'
    overrides.write_text(json.dumps({'version': 1, 'groups': [
        {'from': ' BRAND ', 'to': ' CUP ', 'reason': 'Cup', 'ids': ['brand_cup']},
        {'from': 'brand', 'to': 'door', 'reason': 'Door', 'ids': ['brand_door']},
        {'from': 'brand', 'to': 'not-an-existing-type', 'reason': 'Unavailable', 'ids': ['brand_unknown']},
    ]}))
    library.category_overrides = overrides
    for _ in range(2):
        result = library.build()
        assert result['category_changes'] == 2
        assert result['category_overrides_skipped'] == [{'id': 'brand_unknown', 'reason': 'target_missing'}]
        assert library.list()['total'] == 6 and library.list()['stored'] == 5
        assert library.get('brand_cup')['category'] == 'cup'
        assert library.get('brand_door')['category'] == 'door'
        assert library.get('brand_unknown')['category'] == 'brand'
        assert library.list(query='Brand', category=['cup', 'door'])['total'] == 2
        assert library.list(query='Brand')['total'] == 3
        assert library.list(category='Brand')['total'] == 1
        assert before == {row['id']: library.manifest(row['id']) for row in entries}
        assert preview == cache.target('brand_cup')


def test_category_override_does_not_reclassify_changed_source(library):
    path = library.root / 'overrides.json'
    path.write_text(json.dumps({'version': 1, 'groups': [
        {'from': 'old-brand', 'to': 'door', 'reason': 'Outdated review', 'ids': ['test_cup']},
        {'from': 'cup', 'to': 'door', 'reason': 'Other catalog', 'ids': ['not_in_this_catalog']},
    ]}))
    entries = json.loads((library.catalog / 'index.json').read_text())
    resolved, skipped = resolve_category_overrides(entries, path)
    assert resolved == {}
    assert skipped == [{'id': 'test_cup', 'reason': 'source_changed'},
                       {'id': 'not_in_this_catalog', 'reason': 'model_missing'}]


def test_explicit_new_category_survives_rebuild_without_changing_source(library):
    from model_thumbnails import ThumbnailCache
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    entries += [dict(entries[0], id='test_shoe', category='Cream', label='Cream brand ballet flat'),
                dict(entries[0], id='test_ice_cream', category='Cream', label='Ice cream')]
    index.write_text(json.dumps(entries))
    library.build()
    manifest = library.manifest('test_shoe')
    thumbnail = ThumbnailCache(library).target('test_shoe')
    path = library.root / 'overrides.json'
    path.write_text(json.dumps({'version': 1, 'new_categories': ['shoes'], 'groups': [
        {'from': 'cream', 'to': 'shoes', 'reason': 'Footwear', 'ids': ['test_shoe']},
    ]}))
    library.category_overrides = path
    for _ in range(2):
        result = library.build()
        assert result['category_changes'] == 1 and result['category_overrides_skipped'] == []
        assert library.list(category=' SHOES ')['items'][0]['id'] == 'test_shoe'
        assert library.list(category='cream')['items'][0]['id'] == 'test_ice_cream'
        assert library.list(query='cream', category='shoes')['total'] == 1
        assert {'category': 'shoes', 'count': 1} in library.list()['categories']
        assert library.get('test_shoe')['entry']['category'] == 'Cream'
        assert library.manifest('test_shoe') == manifest
        assert ThumbnailCache(library).target('test_shoe') == thumbnail


def test_reviewed_footwear_ids_exclude_mixed_category_nonshoes():
    path = Path(__file__).resolve().parents[1] / 'model_category_overrides.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    assert 'shoes' in data['new_categories']
    assignments = {asset_id: group['to'] for group in data['groups'] for asset_id in group['ids']}
    shoes = {asset_id for asset_id, category in assignments.items() if category == 'shoes'}
    assert len(shoes) == 255
    assert {'gso_cream_tieks_italian_leather_ballet_flats_ef7ec2f4',
            'gso_great_jones_wingtip_6e64c435', 'gso_d_rose_45_8e26bd44',
            'gso_grand_prix_c3b84ec2', 'gso_hilary_2f406468',
            'gso_real_deal_1niwchx1mth_82d9c7fb', 'gso_top_ten_hi_ce921a52'} <= shoes
    assert not shoes.intersection({'gso_womens_multi_13_2b722632',
        'gso_great_dinos_triceratops_toy_7fc8e736', 'rc_aigen_objs_ice_cream_ice_cream_0_4fbecc30',
        'gso_vans_cereal_honey_nut_crunch_11_oz_box_22198eeb',
        'gso_top_paw_dog_bow_bone_ceramic_13_fl_oz_total_6c6d4277'})
    assert assignments['gso_top_paw_dog_bow_bone_ceramic_13_fl_oz_total_6c6d4277'] == 'bowl'


def test_reviewed_toys_and_supplements_preserve_mixed_category_exceptions(library):
    from model_thumbnails import ThumbnailCache
    rules = json.loads(library.category_overrides.read_text(encoding='utf-8'))
    assert 'supplements' in rules['new_categories']
    assignments = {asset_id: group['to'] for group in rules['groups'] for asset_id in group['ids']}
    assert sum(value == 'toys' for value in assignments.values()) == 243
    assert sum(value == 'supplements' for value in assignments.values()) == 63
    cases = [
        ('gso_lego_5887_dino_defense_hq_27091cee', 'lego', 'toys'),
        ('gso_twinlab_premium_creatine_fuel_powder_10b0ea89', 'twinlab', 'supplements'),
        ('gso_womens_multi_13_2b722632', 'womens', 'supplements'),
        ('gso_pet_dophilus_powder_7ad054bf', 'pet', 'supplements'),
        ('gso_animal_planet_foam_2headed_dragon_90993eb0', 'animal', 'toys'),
        ('gso_animal_crossing_new_leaf_nintendo_3ds_game_f069bc63', 'animal', 'software'),
        ('gso_food_beverage_set_2ca5d358', 'food', 'toys'),
        ('real_food', 'food', 'food'),
        ('gso_ortho_forward_facing_3q6j2okjd92_dace488d', 'ortho', 'toys'),
        ('gso_ortho_forward_facing_ckaw6rl25xh_6f32d851', 'ortho', 'helmets'),
        ('gso_perricone_md_omega_3_supplements_3476e63a', 'perricone', 'supplements'),
        ('gso_perricone_md_vitamin_c_ester_serum_94506e1d', 'perricone', 'personal_care'),
        ('gso_phillips_colon_health_probiotic_capsule_30d5b5b1', 'phillips', 'supplements'),
        ('gso_phillips_milk_of_magnesia_saline_laxative_liquid_original_7fa20651', 'phillips', 'medical_supplies'),
        ('gso_xyli_pure_xylitol_295b0fd5', 'xyli', 'food'),
        ('gso_arm_hammer_diaper_pail_refills_12_pack_mfwkmoweejt_b288dbbb', 'arm', 'personal_care'),
        ('gso_little_big_planet_3_plush_edition_d2a83c94', 'little', 'software'),
        ('gso_sootheze_cold_therapy_elephant_f16c361a', 'sootheze', 'medical_supplies'),
        ('gso_cole_hardware_hammer_black_c05979e8', 'cole', 'tools'),
        ('gso_toys_r_us_treat_dispenser_smart_puzzle_foobler_ee381319', 'toys', 'toys'),
        ('future_unknown_lego_product', 'lego', 'lego'),
    ]
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    entries += [dict(entries[0], id=asset_id, category=source, label=asset_id)
                for asset_id, source, _ in cases]
    index.write_text(json.dumps(entries))
    library.build()
    manifests = {asset_id: library.manifest(asset_id) for asset_id, _, _ in cases}
    thumbnails = {asset_id: ThumbnailCache(library).target(asset_id) for asset_id, _, _ in cases}
    for _ in range(2):
        library.build()
        for asset_id, source, target in cases:
            assert library.get(asset_id)['category'] == target
            assert library.get(asset_id)['entry']['category'] == source
            assert library.manifest(asset_id) == manifests[asset_id]
            assert ThumbnailCache(library).target(asset_id) == thumbnails[asset_id]
            assert any(row['id'] == asset_id for row in library.list(query=source, category=target)['items'])
        assert library.list(category=['toys', 'supplements'])['total'] == 10


def test_reviewed_produce_ids_preserve_original_tags_and_preview_keys(library):
    from model_thumbnails import ThumbnailCache
    rules_path = library.category_overrides
    rules = json.loads(rules_path.read_text(encoding='utf-8'))
    assignments = {asset_id: group['to'] for group in rules['groups'] for asset_id in group['ids']}
    assert 'vegetable' in rules['new_categories']
    assert sum(value == 'fruit' for value in assignments.values()) == 376
    assert sum(value == 'vegetable' for value in assignments.values()) == 357
    cases = [
        ('rc_aigen_objs_apple_apple_0_1b050243', 'apple', 'fruit'),
        ('rc_aigen_objs_banana_banana_0_bb761c69', 'banana', 'fruit'),
        ('robosuite_lemon', 'fruit', 'fruit'),
        ('rc_objaverse_bell_pepper_bell_pepper_0_3b25d479', 'bell', 'vegetable'),
        ('rc_objaverse_tomato_tomato_0_1a7a4fbb', 'tomato', 'vegetable'),
        ('rc_objaverse_mushroom_mushroom_0_b373b439', 'mushroom', 'vegetable'),
        ('rc_objaverse_sweet_potato_sweet_potato_3_7da5d0be', 'potato', 'vegetable'),
        ('gso_olive_kids_birdie_lunch_box_e061f1ed', 'olive', 'bags'),
        ('gso_sapota_threshold_4_ceramic_round_planter_red_295a4421', 'sapota', 'planters'),
        ('gso_apples_to_apples_kids_edition_6aec3750', 'apples', 'toys'),
        ('gso_fruit_veggie_domino_gradient_0a3474ce', 'fruit', 'toys'),
        ('rc_aigen_objs_walnut_walnut_0_50d35f33', 'walnut', 'food'),
        ('rc_aigen_objs_pickle_pickle_0_f10e6a12', 'pickle', 'food'),
        ('future_unreviewed_apple', 'apple', 'apple'),
    ]
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    entries += [dict(entries[0], id=asset_id, category=source, label=asset_id, tags=[source, 'original'])
                for asset_id, source, _ in cases]
    entries.append(dict(entries[0], id='existing_toy', category='toys'))
    entries.append(dict(entries[0], id='existing_food', category='food'))
    index.write_text(json.dumps(entries))
    empty_rules = library.root / 'before-produce.json'
    empty_rules.write_text(json.dumps({'version': 1, 'groups': []}))
    library.category_overrides = empty_rules
    library.build()
    manifests = {asset_id: library.manifest(asset_id) for asset_id, _, _ in cases}
    thumbnails = {asset_id: ThumbnailCache(library).target(asset_id) for asset_id, _, _ in cases}
    library.category_overrides = rules_path
    for _ in range(2):
        library.build()
        for asset_id, source, target in cases:
            item = library.get(asset_id)
            assert item['category'] == target
            assert item['entry']['category'] == source
            assert item['entry']['tags'] == [source, 'original']
            assert library.manifest(asset_id) == manifests[asset_id]
            assert ThumbnailCache(library).target(asset_id) == thumbnails[asset_id]
            assert asset_id in {row['id'] for row in library.list(query=source, exact_category=target)['items']}
        assert library.list(exact_category='fruit')['total'] == 3
        assert library.list(exact_category=' VEGETABLE ')['total'] == 4
        assert library.list(exact_category='banana')['total'] == 0
        assert library.list(exact_category='apple')['total'] == 1
        for category, total in [('fruit', 3), ('vegetable', 4)]:
            preview = library.category_previews(category)
            assert preview['total'] == total
            assert all(library.get(row['id'])['category'] == category for row in preview['items'])


def test_reviewed_food_merge_excludes_tools_soap_produce_and_toys(library):
    from model_thumbnails import ThumbnailCache
    rules_path = library.category_overrides
    cases = [
        ('gso_little_debbie_cloud_cakes_10_ct_eab40a6e', 'little', 'food'),
        ('gso_nescafe_16count_dolce_gusto_cappuccino_capsules_4ec4b024', 'nescafe', 'food'),
        ('gso_vans_cereal_honey_nut_crunch_11_oz_box_22198eeb', 'vans', 'food'),
        ('rc_aigen_objs_bar_bar_0_780d9749', 'bar', 'food'),
        ('rc_aigen_objs_bar_soap_bar_soap_0_fe64482e', 'bar', 'soap'),
        ('rc_aigen_objs_can_can_0_dec4b607', 'can', 'food'),
        ('rc_aigen_objs_can_opener_can_opener_0_59cb22b8', 'can', 'can_opener'),
        ('rc_aigen_objs_sushi_sushi_0_63286627', 'sushi', 'food'),
        ('gso_sushi_mat_4d7bfd68', 'sushi', 'kitchen_tools'),
        ('gso_snack_catcher_snack_dispenser_065861f4', 'snack', 'cup'),
        ('gso_little_big_planet_3_plush_edition_d2a83c94', 'little', 'software'),
        ('gso_food_beverage_set_2ca5d358', 'food', 'toys'),
        ('gso_womens_multi_13_2b722632', 'womens', 'supplements'),
        ('rc_aigen_objs_apple_apple_0_1b050243', 'apple', 'fruit'),
        ('rc_objaverse_tomato_tomato_0_1a7a4fbb', 'tomato', 'vegetable'),
        ('future_unreviewed_nescafe', 'nescafe', 'nescafe'),
        ('existing_food', 'food', 'food'),
        ('existing_toy', 'toys', 'toys'),
        ('existing_fruit', 'fruit', 'fruit'),
    ]
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    entries += [dict(entries[0], id=asset_id, category=source, label=asset_id, tags=[source, 'original'])
                for asset_id, source, _ in cases]
    index.write_text(json.dumps(entries))
    empty_rules = library.root / 'before-food.json'
    empty_rules.write_text(json.dumps({'version': 1, 'groups': []}))
    library.category_overrides = empty_rules
    library.build()
    manifests = {asset_id: library.manifest(asset_id) for asset_id, _, _ in cases}
    thumbnails = {asset_id: ThumbnailCache(library).target(asset_id) for asset_id, _, _ in cases}
    library.category_overrides = rules_path
    for _ in range(2):
        library.build()
        for asset_id, source, target in cases:
            item = library.get(asset_id)
            assert item['category'] == target
            assert item['entry']['category'] == source
            assert item['entry']['tags'] == [source, 'original']
            assert library.manifest(asset_id) == manifests[asset_id]
            assert ThumbnailCache(library).target(asset_id) == thumbnails[asset_id]
            assert asset_id in {row['id'] for row in library.list(query=source, exact_category=target)['items']}
        assert library.list(exact_category=' FOOD ')['total'] == 7
        assert library.list(exact_category='nescafe')['total'] == 1
        assert library.list(exact_category='food', query='nescafe')['total'] == 1
        preview = library.category_previews('food')
        assert preview['total'] == 7
        assert all(library.get(row['id'])['category'] == 'food' for row in preview['items'])


@pytest.mark.parametrize('invalid', [
    {'version': 2, 'groups': []},
    {'version': 1, 'groups': [{'from': 'cup', 'to': 'door', 'ids': ['test_cup']}]},
    {'version': 1, 'groups': [{'from': 'cup', 'to': ' CUP ', 'reason': 'Same', 'ids': ['test_cup']}]},
    {'version': 1, 'groups': [{'from': 'cup', 'to': 'door', 'reason': 'Repeated', 'ids': ['test_cup', 'test_cup']}]},
    {'version': 1, 'groups': [{'from': 'cup', 'to': 'door', 'reason': 'Bad id', 'ids': ['../cup']}]},
    {'version': 1, 'groups': [], 'new_categories': 'shoes'},
    {'version': 1, 'groups': [], 'new_categories': ['shoes', 'shoes']},
    {'version': 1, 'groups': [], 'new_categories': [None]},
    {'version': 1, 'groups': [], 'new_categories': ['../shoes']},
    {'version': 1, 'groups': [], 'new_categories': ['']},
    [],
])
def test_invalid_category_rules_do_not_replace_database(library, invalid):
    path = library.root / 'overrides.json'
    path.write_text(json.dumps(invalid))
    library.category_overrides = path
    before = library.database.read_bytes()
    with pytest.raises(ValueError):
        library.build()
    assert library.database.read_bytes() == before


def test_reviewed_brand_assignments_do_not_include_accessories():
    data = json.loads((Path(__file__).resolve().parents[1] / 'model_category_overrides.json').read_text(encoding='utf-8'))
    assignments = {asset_id: group['to'] for group in data['groups'] for asset_id in group['ids']}
    assert assignments['gso_razer_abyssus_ambidextrous_gaming_mouse_f0010356'] == 'mouse'
    assert assignments['gso_razer_blackwidow_tournament_edition_keyboard_358ec474'] == 'keyboard'
    assert assignments['gso_razer_goliathus_control_edition_small_soft_gaming_mouse_mat_cbd24a3d'] == 'mouse_pad'
    assert assignments['gso_canon_pixma_ink_cartridge_251_m_86944e55'] == 'printer_supplies'
    assert assignments['gso_nescafe_16count_dolce_gusto_cappuccino_capsules_4ec4b024'] == 'food'
    assert assignments['gso_ecoforms_plant_pot_gp9_sand_68744aa6'] == 'planters'


def test_reviewed_object_identity_and_attributes_preserve_source_and_images(library):
    from model_thumbnails import ThumbnailCache
    rules_path = library.category_overrides
    cases = [
        ('gso_horses_in_pink_pencil_case_3589bc32', 'horses', 'bags', '笔袋'),
        ('gso_us_army_stash_lunch_bag_6c83b001', 'us', 'bags', '午餐包'),
        ('gso_asus_80211ac_dualband_gigabit_wireless_router_rtac68r_836970a0', 'asus', 'network_devices', '路由器'),
        ('gso_asus_m5a78lmusb3_motherboard_micro_atx_socket_am3_b27d58e2', 'asus', 'computer_components', '主板'),
        ('gso_big_o_sponges_assorted_cellulose_12_pack_052502b2', 'big', 'sponge', '清洁海绵'),
        ('gso_big_dot_pink_pencil_case_59c161c7', 'big', 'bags', '笔袋'),
        ('gso_retail_leadership_summit_e1366345', 'retail', 'hats', '帽子'),
        ('gso_fujifilm_instax_share_sp1_10_photos_390bd626', 'fujifilm', 'printer', '便携照片打印机'),
        ('gso_prosport_harness_to_booster_seat_df164210', 'prosport', 'needs_review', '名称与外观不一致'),
        ('future_unreviewed_horses', 'horses', 'horses', None),
    ]
    index = library.catalog / 'index.json'
    entries = json.loads(index.read_text())
    entries += [dict(entries[0], id=asset_id, category=source, label=asset_id, tags=[source, 'original'])
                for asset_id, source, _, _ in cases]
    entries += [dict(entries[0], id='existing_' + category, category=category) for category in ['sponge', 'printer']]
    index.write_text(json.dumps(entries))
    empty_rules = library.root / 'before-taxonomy.json'
    empty_rules.write_text(json.dumps({'version': 1, 'groups': []}))
    library.category_overrides = empty_rules
    library.build()
    manifests = {id: library.manifest(id) for id, _, _, _ in cases}
    thumbnails = {id: ThumbnailCache(library).target(id) for id, _, _, _ in cases}
    library.category_overrides = rules_path
    for _ in range(2):
        result = library.build()
        for id, source, target, subtype in cases:
            item = library.get(id)
            assert item['category'] == target
            assert item['entry']['category'] == source
            assert item['entry']['tags'] == [source, 'original']
            assert library.manifest(id) == manifests[id]
            assert ThumbnailCache(library).target(id) == thumbnails[id]
            if subtype:
                assert item['classification']['subcategory'] == subtype
            else:
                assert 'classification' not in item
        horse = library.get(cases[0][0])
        assert horse['classification']['attributes'] == {'color': '粉色', 'pattern': '马图案'}
        assert library.get(cases[1][0])['classification']['attributes'] == {'brand': 'US Army', 'pattern': '迷彩'}
        assert library.get(cases[-2][0])['classification']['status'] == 'needs_review'
        assert library.list(query='笔袋 粉色', exact_category='bags')['total'] == 2
        assert library.list(query='马图案', exact_category='bags')['total'] == 1
        assert library.list(query='horses', exact_category='bags')['total'] == 1
        assert result['classification_details'] == 9


@pytest.mark.parametrize('detail', [
    None,
    {'from': 'cup', 'category': 'cup', 'subcategory': '杯子', 'attributes': [], 'status': 'reviewed', 'note': 'Reviewed'},
    {'from': 'cup', 'category': 'cup', 'subcategory': '', 'attributes': {}, 'status': 'reviewed', 'note': 'Reviewed'},
    {'from': 'cup', 'category': 'cup', 'subcategory': '杯子', 'attributes': {'color': 42}, 'status': 'reviewed', 'note': 'Reviewed'},
    {'from': 'cup', 'category': 'cup', 'subcategory': '杯子', 'attributes': {}, 'status': 'guessed', 'note': 'Guessed'},
])
def test_invalid_classification_details_do_not_replace_inventory(library, detail):
    path = library.root / 'invalid-details.json'
    path.write_text(json.dumps({'version': 1, 'groups': [], 'details': {'test_cup': detail}}))
    library.category_overrides = path
    before = library.database.read_bytes()
    with pytest.raises(ValueError):
        library.build()
    assert library.database.read_bytes() == before


def test_stale_classification_details_are_skipped(library):
    path = library.root / 'stale-details.json'
    detail = {'from': 'cup', 'category': 'door', 'subcategory': '杯子', 'attributes': {},
              'status': 'reviewed', 'note': 'Reviewed original cup'}
    rules = {'version': 1, 'groups': [], 'details': {'test_cup': detail}}
    path.write_text(json.dumps(rules))
    library.category_overrides = path
    result = library.build()
    assert result['classification_details_skipped'] == [{'id': 'test_cup', 'reason': 'category_changed'}]
    assert 'classification' not in library.get('test_cup')
    rules['details']['test_cup']['from'] = 'mug'
    path.write_text(json.dumps(rules))
    result = library.build()
    assert result['classification_details_skipped'] == [{'id': 'test_cup', 'reason': 'source_changed'}]


def test_cross_model_files_and_missing_resources(library):
    with pytest.raises(ValueError):
        library.asset_file('test_cup', 'door/part.obj')
    with pytest.raises(FileNotFoundError):
        library.file('cup/not-indexed.txt')
    (library.catalog / 'cup/texture.png').unlink()
    with pytest.raises(FileNotFoundError):
        library.view('test_cup')
    with pytest.raises(FileNotFoundError):
        library.view('test_missing')


def test_urdf_cycle_rejected(library):
    file = library.catalog / 'door/mobility.urdf'
    xml = file.read_text().replace('<parent link="base"/>', '<parent link="door"/>')
    file.write_text(xml)
    with pytest.raises(ValueError, match='link graph'):
        library.view('test_door')


def test_routes_and_file_hash(library):
    app = FastAPI()
    app.include_router(create_model_router(library))
    with TestClient(app) as client:
        assert client.get('/api/model-library?page_size=0').status_code == 422
        assert client.get('/api/model-library/unknown').status_code == 404
        assert client.get('/api/model-library/test_missing/view').status_code == 404
        assert client.get('/api/model-library/test_cup/view').status_code == 200
        result = client.get('/api/model-library/file', params={'path': 'cup/texture.png'})
        assert result.status_code == 200
        assert result.headers['x-content-sha256'] == hashlib.sha256(result.content).hexdigest()
        assert result.headers['cache-control'] == 'private, no-store'


def test_thumbnail_cache_validation_and_invalidation(library, monkeypatch):
    from PIL import Image, ImageDraw
    from model_thumbnails import ThumbnailCache, save_preview
    cache = ThumbnailCache(library)
    target = cache.target('test_cup')
    image = Image.new('RGBA', (960, 720))
    ImageDraw.Draw(image).rectangle((300, 250, 660, 470), fill='red')
    png = io.BytesIO()
    image.save(png, format='PNG')
    save_preview(png.getvalue(), target)
    assert cache.request('test_cup') == target
    with Image.open(target) as saved:
        assert saved.format == 'WEBP' and saved.size == (480, 360)
        assert saved.getpixel((0, 0))[3] == 0
        left, top, right, bottom = saved.getchannel('A').getbbox()
        assert left >= 24 and top >= 24 and right <= 456 and bottom <= 336
        assert right - left >= 430
    empty = io.BytesIO()
    Image.new('RGBA', (960, 720)).save(empty, format='PNG')
    with pytest.raises(ValueError, match='Empty'):
        save_preview(empty.getvalue(), target)
    assert target.is_file()
    (library.catalog / 'cup/texture.png').write_bytes(b'updated-texture')
    library.build()
    assert cache.target('test_cup') != target
    with pytest.raises(FileNotFoundError):
        cache.target('test_missing')
    with pytest.raises(KeyError):
        cache.target('../outside')


def test_thumbnail_queue_deduplicates_and_bounds_work(library, monkeypatch):
    import threading
    from model_thumbnails import ThumbnailCache, MAX_PENDING
    cache = ThumbnailCache(library)
    monkeypatch.setattr(threading.Thread, 'start', lambda self: None)
    assert cache.request('test_cup') == {'status': 'pending'}
    assert cache.request('test_cup') == {'status': 'pending'}
    assert cache._jobs.qsize() == 1
    for i in range(MAX_PENDING * 2):
        monkeypatch.setattr(cache, 'target', lambda _, i=i: library.root / f'fake-{i}.webp')
        cache.request('test_cup')
    assert cache._jobs.qsize() == MAX_PENDING and len(cache._pending) == MAX_PENDING


def test_thumbnail_routes_pending_failure_and_image(library, monkeypatch, tmp_path):
    app = FastAPI()
    app.include_router(create_model_router(library))
    with TestClient(app) as client:
        monkeypatch.setattr(library, 'thumbnail', lambda _: {'status': 'pending'})
        response = client.get('/api/model-library/test_cup/thumbnail')
        assert response.status_code == 202 and response.headers['retry-after'] == '3'
        monkeypatch.setattr(library, 'thumbnail', lambda _: {'status': 'failed', 'detail': 'Unavailable'})
        assert client.get('/api/model-library/test_cup/thumbnail').json()['status'] == 'failed'
        image = tmp_path / 'preview.webp'
        image.write_bytes(b'webp-fixture')
        monkeypatch.setattr(library, 'thumbnail', lambda _: image)
        response = client.get('/api/model-library/test_cup/thumbnail')
        assert response.headers['content-type'] == 'image/webp'
        assert response.headers['cache-control'].startswith('private')
        assert 'Authorization' in response.headers['vary']


def test_thumbnail_failure_cooldown_allows_later_retry(library, monkeypatch):
    import threading
    import model_thumbnails
    cache = model_thumbnails.ThumbnailCache(library)
    target = cache.target('test_cup')
    monkeypatch.setattr(threading.Thread, 'start', lambda self: None)
    monkeypatch.setattr(model_thumbnails.time, 'monotonic', lambda: 1000)
    cache._failures[target.name] = (999, 'Unavailable')
    assert cache.request('test_cup')['status'] == 'failed'
    assert cache._jobs.empty()
    monkeypatch.setattr(model_thumbnails.time, 'monotonic', lambda: 1300)
    assert cache.request('test_cup')['status'] == 'pending'
    assert cache._jobs.qsize() == 1


def test_batch_prewarm_resumes_and_retries_only_when_requested(library, tmp_path):
    from PIL import Image
    from model_thumbnail_prewarm import prewarm, valid_preview

    class Cache:
        fail = True

        def __init__(self):
            self.calls = []

        def target(self, asset_id):
            return tmp_path / 'previews' / (asset_id + '.webp')

        def _render(self, asset_id, target):
            self.calls.append(asset_id)
            if self.fail and asset_id == 'test_door':
                raise ValueError('Missing mesh')
            target.parent.mkdir(exist_ok=True)
            Image.new('RGBA', (480, 360), 'red').save(target, format='WEBP')

    cache = Cache()
    state = tmp_path / 'prewarm'
    source_before = {p: p.read_bytes() for p in library.catalog.rglob('*') if p.is_file()}
    first = prewarm(library, cache, state, minimum_free=0)
    assert first['phase'] == 'completed_with_errors'
    assert (first['total'], first['metadata_only'], first['ready'], first['failed']) == (2, 1, 1, 1)
    assert set(cache.calls) == {'test_cup', 'test_door'}
    cache.calls.clear()
    second = prewarm(library, cache, state, minimum_free=0)
    assert not cache.calls and second['cached'] == 1 and second['failed'] == 1
    cache.fail = False
    third = prewarm(library, cache, state, retry_failed=True, minimum_free=0)
    assert cache.calls == ['test_door']
    assert third['phase'] == 'completed' and third['ready'] == 2 and third['pending'] == 0
    assert valid_preview(cache.target('test_door'))
    cache.target('test_cup').write_bytes(b'broken-preview')
    assert not valid_preview(cache.target('test_cup'))
    cache.calls.clear()
    repaired = prewarm(library, cache, state, minimum_free=0)
    assert cache.calls == ['test_cup'] and repaired['ready'] == 2
    assert source_before == {p: p.read_bytes() for p in library.catalog.rglob('*') if p.is_file()}
    assert json.loads((state / 'progress.json').read_text())['phase'] == 'completed'
    blocked = prewarm(library, cache, state, minimum_free=10**20)
    assert blocked['phase'] == 'completed', 'fully cached jobs should not need extra disk'
    cache.target('test_cup').unlink()
    blocked = prewarm(library, cache, state, minimum_free=10**20)
    assert blocked['phase'] == 'waiting_for_disk' and blocked['pending'] == 1
    interrupted = {**blocked, 'phase': 'rendering', 'current_key': 'test_cup.webp'}
    (state / 'progress.json').write_text(json.dumps(interrupted))
    cache.calls.clear()
    resumed = prewarm(library, cache, state, minimum_free=0)
    assert not cache.calls and resumed['failed'] == 1
    assert 'interrupted' in resumed['failures'][0]['error']


def test_renderer_rechecks_cache_after_shared_lock(library, monkeypatch):
    from model_thumbnails import ThumbnailCache
    cache = ThumbnailCache(library)
    target = cache.target('test_cup')
    target.parent.mkdir(parents=True)
    target.write_bytes(b'existing')
    calls = []
    monkeypatch.setattr(cache, '_render_unlocked', lambda *args: calls.append(args))
    cache._render('test_cup', target)
    assert not calls
    target.unlink()
    cache._render('test_cup', target)
    assert calls == [('test_cup', target)]


def test_existing_web_auth_protects_model_data(library, monkeypatch, tmp_path):
    monkeypatch.setenv('CLOUD_CONSOLE_STORAGE_DIR', str(tmp_path / 'app'))
    import main
    monkeypatch.setattr(main, 'WEB_MODE', True)
    monkeypatch.setattr(main.model_library, 'root', library.root)
    monkeypatch.setattr(main.model_library, 'catalog', library.catalog)
    monkeypatch.setattr(main.model_library, 'database', library.database)
    monkeypatch.setattr(main, '_account_for_web_token', lambda token: {'username': 'reader', 'role': 'user'} if token == 'session' else None)
    monkeypatch.setenv('CLOUD_CONSOLE_MODEL_TOKEN_SHA256', hashlib.sha256(b'machine-test').hexdigest())
    with TestClient(main.app) as client:
        assert client.get('/api/model-library').status_code == 401
        assert client.get('/api/model-library/file?path=cup/texture.png').status_code == 401
        assert client.get('/api/model-library/test_cup/thumbnail').status_code == 401
        assert client.get('/api/model-library/categories').status_code == 401
        assert client.get('/api/model-library/category-previews?category=cup').status_code == 401
        assert client.get('/api/model-library', headers={'Authorization': 'Bearer session'}).status_code == 403
        monkeypatch.setenv('CLOUD_CONSOLE_MODEL_READERS', 'reader')
        assert client.get('/api/model-library', headers={'Authorization': 'Bearer session'}).status_code == 200
        assert client.get('/api/model-library', headers={'X-Model-Library-Token': 'machine-test'}).status_code == 200
        assert client.get('/api/model-library/categories', headers={'X-Model-Library-Token': 'machine-test'}).status_code == 200
        assert client.get('/api/model-library/category-previews?category=cup', headers={'Authorization': 'Bearer session'}).status_code == 200
        assert client.get('/api/model-library', headers={'X-Model-Library-Token': 'wrong'}).status_code == 401
        assert client.post('/api/model-library', headers={'X-Model-Library-Token': 'machine-test'}).status_code == 401
