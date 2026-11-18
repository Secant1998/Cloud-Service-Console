"""Validate HTTPS retrieval and scene materialization into a fresh, disposable cache."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SIM = Path(r'E:\Desktop\123\code_1015')
sys.path.insert(0, str(SIM / 'shared/simulators'))
from asset_catalog import AssetCatalog
from asset_remote import RemoteAssetStore


def main():
    credentials = json.loads((Path.home() / '.config/telebot-model-library.json').read_text(encoding='utf-8'))
    base = credentials['base_url']
    with urlopen(base + '/api/health', timeout=30) as response:
        assert response.status == 200
    try:
        urlopen(base + '/api/model-library', timeout=30)
        raise AssertionError('Anonymous library access was permitted')
    except HTTPError as exc:
        assert exc.code == 401
    request = Request(base + '/api/model-library', headers={'X-Model-Library-Token': credentials['token']})
    with urlopen(request, timeout=30) as response:
        listing = json.load(response)
    assert listing['stored'] == 5917, listing['stored']
    print(json.dumps({'models': listing['indexed'], 'stored': listing['stored'], 'anonymous': 'denied'}), flush=True)
    with tempfile.TemporaryDirectory(prefix='model-library-cache-proof-') as directory:
        root = Path(directory)
        (root / 'remote-library.json').write_text(json.dumps({'base_url': base}))
        store = RemoteAssetStore(root)
        # Production retains its local indexes; only model bodies start uncached.
        shutil.copy2(SIM / 'shared/assets/catalog/index.json', root / 'index.json')
        shutil.copy2(SIM / 'shared/assets/catalog/texture-index.json', root / 'texture-index.json')
        catalog = AssetCatalog(root)
        examples = ['gso_11pro_sl_trx_fg_4f03f643', 'rc_aigen_objs_alcohol_alcohol_0_4b87a281', 'partnet_7119', 'robosuite_milk']
        for asset_id in examples:
            row, descriptor = catalog.acquire(asset_id)
            assert descriptor.is_file()
            if row.get('descriptor_format') != 'urdf':
                result = catalog.materialize(asset_id, root / 'test-package', 'test_' + asset_id, [.1, .1, .1])
                assert result
                if row.get('local_collision_meshes'):
                    collisions = catalog.collision_meshes(asset_id, root / 'test-package', 'test_' + asset_id, [.1, .1, .1])
                    assert collisions and all((root / 'test-package' / path).is_file() for path in collisions)
                    print(json.dumps({'id': asset_id, 'collision_meshes': len(collisions)}), flush=True)
            else:
                catalog.local_file(row['structure_file'])
            print(json.dumps({'id': asset_id, 'acquired': True, 'materialized': row.get('descriptor_format') != 'urdf'}), flush=True)
        texture = catalog.search_textures(limit=1)[0]
        result = catalog.materialize_texture(texture['id'], root / 'test-package')
        assert (root / 'test-package' / result).is_file()
        print(json.dumps({'texture': texture['id'], 'materialized': True}), flush=True)
        print(json.dumps({'temporary_cache_bytes': sum(file.stat().st_size for file in root.rglob('*') if file.is_file())}), flush=True)
    print(json.dumps({'fresh_cache_test': 'passed', 'temporary_files_removed': True}), flush=True)
    proof = Path(__file__).resolve().parents[1] / 'build/model-library-cache-proof.json'
    proof.write_text(json.dumps({'passed': True, 'time': time.time(), 'base_url': base,
                                 'models': listing['indexed'], 'stored': listing['stored']}), encoding='utf-8')


if __name__ == '__main__':
    main()
