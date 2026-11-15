"""Pure helpers of check_accuracy.py and topo_overlay.py, plus the committed Gale outputs (no raw data needed)."""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'data', 'pipeline'))
import itertools

import check_accuracy as ca
import topo_overlay as to

GALE = os.path.join(HERE, '..', 'data', 'worlds', 'gale')


def load_json(path):
    with open(path) as fh:
        return json.load(fh)


def test_stats_removes_bias():
    s = ca.stats([1.0, 1.2, 0.8, 1.0])
    assert s['bias_m'] == 1.0 and s['max_abs_after_bias_m'] == 0.2


def test_rover_steps_reads_passable_bits():
    n = 3
    passable = [0] * 9
    passable[4] = 1 << ca.NB.index((1, 0))  # centre -> east open, centre -> south closed
    o, b, where = ca.rover_steps([[1, 1], [2, 1]], passable, n)
    assert (o, b) == (1, 0)
    o, b, where = ca.rover_steps([[1, 1], [1, 2]], passable, n)
    assert (o, b, where) == (0, 1, [[1, 1, 1, 2]])


def test_cells_along_steps_are_neighbours():
    cells = ca.cells_along([[1, 1], [40, 23]], 8)
    assert cells[0] == [0, 0] and cells[-1] == [5, 2]
    assert all(max(abs(a[0] - b[0]), abs(a[1] - b[1])) == 1 for a, b in itertools.pairwise(cells))


def test_lane_reason_flags_a_ledge():
    k = 8
    h1 = np.zeros((16, 8))
    h1[8:] = 1.5  # 1.5 m step between the two cells, flat otherwise (smeared over 2 samples)
    steep = np.zeros_like(h1, 'f4')
    over, run, step = to.lane_reason(h1, steep, k, 0, 0, 0, 1, 20, {'step_max_m': 0.3, 'steep_run_m': 3,
                                                                    'lane_offset_m': 2})
    assert over > 1 and step >= 0.7 and run == 0


def test_gale_outputs_are_consistent():
    if not os.path.exists(os.path.join(GALE, 'validation.json')):
        return
    v = load_json(os.path.join(GALE, 'validation.json'))
    assert v['waypoints'] == len(v['profile']) >= 10
    assert v['terrain_1m']['rmse_after_bias_m'] <= v['grid_8m']['rmse_after_bias_m']
    r = load_json(os.path.join(GALE, 'route_3d.json'))
    route = load_json(os.path.join(GALE, 'route.json'))
    cell = 8.0
    first = [(route['cells'][0][i] + .5) * cell - cell / 2 for i in (0, 1)]
    assert r['points'][0][:2] == first and len(r['points']) >= r['length_m'] * 0.9
    c = load_json(os.path.join(GALE, 'crossings_blocked.json'))
    assert sum(c['counts'].values()) == len(c['crossings'])
    passable = np.fromfile(os.path.join(GALE, 'passable.u8'), 'u1').reshape(256, 256)
    assert all(not (passable[y, x] >> d) & 1 for x, y, d, *_ in c['crossings'][:500])
