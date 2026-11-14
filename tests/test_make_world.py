import importlib.util
import math
import pathlib

spec = importlib.util.spec_from_file_location('make_world', pathlib.Path(__file__).parents[1] / 'data/pipeline/make_world.py')
mw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mw)


def test_cost_to_go_is_zero_at_base_and_grows_outward():
    n, base = 32, [8, 16]
    *_, ctg = mw.build(n, 5.0, base, 2.5e5)
    b = base[1] * n + base[0]
    assert ctg[b] == 0.0
    near, far = ctg[b + 1], ctg[b + 10]
    assert 0 < near < far < math.inf


def test_steeper_and_sandier_costs_more():
    flat_soil = mw.pandolf_watts(0, mw.CLASSES[1][1])
    uphill_soil = mw.pandolf_watts(10, mw.CLASSES[1][1])
    flat_sand = mw.pandolf_watts(0, mw.CLASSES[3][1])
    assert uphill_soil > flat_soil and flat_sand > flat_soil
