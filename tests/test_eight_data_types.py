"""D6: a real world carries all eight NASA data types, each with a source (docs/CONTRACTS.md section 1)."""
import json
import pathlib

import pytest

ROOT = pathlib.Path(__file__).parents[1]
EIGHT = {'optical', 'topographic', 'thermal', 'spectral', 'radiation', 'atmospheric', 'chemical', 'geophysical'}
REAL = [p for p in (ROOT / 'data/worlds').iterdir() if (p / 'world.json').exists()
        and json.loads((p / 'world.json').read_text()).get('source') == 'real']


@pytest.mark.parametrize('world', REAL, ids=[p.name for p in REAL])
def test_all_eight_types_have_files_and_sources(world):
    meta = json.loads((world / 'world.json').read_text())
    types = meta.get('data_types', {})
    assert set(types) == EIGHT
    for kind, name in types.items():
        f = meta['files'].get(name)
        assert f and (world / f).exists(), f'{kind}: {name} has no file'
        assert meta['sources'].get(name), f'{kind}: {name} has no source'


@pytest.mark.parametrize('world', REAL, ids=[p.name for p in REAL])
def test_points_sit_inside_the_grid(world):
    meta = json.loads((world / 'world.json').read_text())
    n = meta['width']
    for name in ('chem_points.json', 'neutron_points.json'):
        path = world / name
        if path.exists():
            for p in json.loads(path.read_text()):
                x, y = p['cell']
                assert 0 <= x < n and 0 <= y < n
