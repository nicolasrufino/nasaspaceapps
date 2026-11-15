"""Walk-scale crossings from 1 m terrain (data/pipeline/terrain_1m.py), on small synthetic terrains."""
import importlib.util
import json
import pathlib

import numpy as np
import pytest

pytest.importorskip('scipy')
pytest.importorskip('rasterio')
ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('terrain_1m', ROOT / 'data/pipeline/terrain_1m.py')
t1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t1)
N, K = 16, 8


def run(h):
    return t1.compute(h, N, K, 25.0, [2, 8])


def test_flat_ground_is_open_everywhere():
    out = run(np.zeros((N * K, N * K)))
    assert out['reach'].all() and out['open_dirs'][1:-1, 1:-1].min() == 8


def test_a_wall_cuts_the_map_and_crossings_stay_symmetric():
    h = np.zeros((N * K, N * K))
    h[:, 80:84] = 5.0  # a 5 m wall, 4 m thick, crossing the whole map (cells x = 10)
    out = run(h)
    assert not out['reach'][:, 11:].any()  # nothing past the wall can be reached from base (x = 2)
    p = out['passable']
    for d, (dx, dy) in enumerate(t1.NB):
        rd = t1.NB.index((-dx, -dy))
        for y in range(1, N - 1):
            for x in range(1, N - 1):
                assert ((p[y, x] >> d) & 1) == ((p[y + dy, x + dx] >> rd) & 1)


def test_a_small_step_is_fine_and_a_ledge_is_not():
    h = np.zeros((N * K, N * K))
    h[:, 80:] = 0.25  # under the 0.3 m suited step limit
    assert run(h)['reach'].all()
    h[:, 80:] = 1.5  # a 1.5 m ledge
    assert not run(h)['reach'][:, 11:].any()


def test_gale_has_the_views():
    meta = json.loads((ROOT / 'data/worlds/gale/world.json').read_text())
    for v in t1.VIEWS + ['passable']:
        assert v in meta['files'] and meta['sources'].get(v)
