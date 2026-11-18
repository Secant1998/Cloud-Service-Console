import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from audit_model_textures import inspect_obj, textured_materials


def test_uv_indices_tiling_and_missing_coordinates(tmp_path):
    file = tmp_path / 'mesh.obj'
    file.write_text('vt 0 0\nvt 2 0\nvt 0 1\nf 1/1 2/2 3/3\nf 1/-3 2/-2 3/-1\n')
    result = inspect_obj(file)
    assert not result['errors']
    assert result['uv_outside_unit_square']
    file.write_text('vt 0 0\nf 1/0 2/2 3/-2\nf 1 2 3\n')
    assert set(inspect_obj(file)['errors']) == {'UV_INDEX_OUT_OF_RANGE', 'TEXTURED_FACE_WITHOUT_UV'}
    file.write_text('vt nan 0\nvt 1\nf 1/1 2/1 3/1\n')
    assert 'UV_NONFINITE_OR_MALFORMED' in inspect_obj(file)['errors']


def test_pure_color_faces_do_not_need_uv(tmp_path):
    mtl = tmp_path / 'mesh.mtl'
    mtl.write_text('newmtl textured\nmap_Kd image.png\nnewmtl plain\nKd 1 1 1\n')
    materials = textured_materials(mtl)
    assert materials == {'textured'}
    file = tmp_path / 'mesh.obj'
    file.write_text('vt 0 0\nusemtl textured\nf 1/1 2/1 3/1\nusemtl plain\nf 1 2 3\n')
    assert not inspect_obj(file, materials)['errors']
    assert inspect_obj(file, materials)['textured_faces'] == 1
    file.write_text('usemtl plain\nf 1 2 3\n')
    assert not inspect_obj(file, materials)['errors']
    file.write_text('usemtl textured\nf 1 2 3\n')
    assert 'TEXTURE_WITHOUT_UV' in inspect_obj(file, materials)['errors']
