import sys
from pathlib import Path
import xml.etree.ElementTree as ET

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from model_library import urdf_controls


def joint(kind='revolute', name='hinge', body=''):
    return f'<joint name="{name}" type="{kind}"><parent link="base"/><child link="{name}"/>{body}</joint>'


def parse(*elements):
    return urdf_controls(ET.fromstring('<robot>' + ''.join(elements) + '</robot>'))


def test_native_axes_limits_and_continuous_joint():
    hinge, slide, wheel = parse(
        joint(body='<axis xyz="0 0 -2"/><limit lower="-0.5" upper="1.5"/>'),
        joint('prismatic', 'slide', '<limit lower="0.01" upper="0.3"/>'),
        joint('continuous', 'wheel'), joint('fixed', 'fixed'))
    assert hinge['axis'] == [0, 0, -1]
    assert (hinge['lower'], hinge['upper']) == (-.5, 1.5)
    assert slide['axis'] == [1, 0, 0] and slide['lower'] == .01
    assert wheel['lower'] is None and wheel['upper'] is None
    assert all('disabled_reason' not in item for item in [hinge, slide, wheel])


@pytest.mark.parametrize('body', ['', '<axis xyz="0 0 0"/>', '<axis xyz="nan 0 1"/>',
    '<axis xyz="0 None 1"/>',
    '<limit lower="2" upper="1"/>', '<limit lower="0" upper="inf"/>', '<limit lower="None" upper="1"/>', '<limit lower="0" upper="0"/>'])
def test_bad_joint_metadata_does_not_break_static_view(body):
    assert parse(joint(body=body))[0]['disabled_reason']


def test_mimic_defaults_and_invalid_graphs():
    valid = parse(joint('continuous'), joint('continuous', 'follower', '<mimic joint="hinge"/>'))
    assert valid[1]['mimic'] == {'joint': 'hinge', 'multiplier': 1, 'offset': 0}
    assert 'disabled_reason' not in valid[1]
    missing = parse(joint('continuous', body='<mimic joint="missing"/>'))
    assert missing[0]['disabled_reason']
    cyclic = parse(joint('continuous', body='<mimic joint="other"/>'),
                   joint('continuous', 'other', '<mimic joint="hinge"/>'))
    assert all(item['disabled_reason'] for item in cyclic)
    with pytest.raises(ValueError):
        parse(joint(), joint())


def test_unsupported_joint_is_explicit():
    assert 'floating' in parse(joint('floating'))[0]['disabled_reason']
