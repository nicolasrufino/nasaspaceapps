"""D4 scout plan: Ingenuity-class flights that never peek at rocks_fine (data/pipeline/scout_plan.py)."""
import importlib.util
import itertools
import json
import pathlib
import shutil

import pytest

ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('scout_plan', ROOT / 'data/pipeline/scout_plan.py')
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)
WORLDS = [p for p in (ROOT / 'data/worlds').iterdir() if (p / 'route.json').exists()]


@pytest.mark.parametrize('world', WORLDS, ids=[p.name for p in WORLDS])
def test_flights_fit_ingenuity_limits(world):
    meta, flights, _ = sp.plan(str(world))
    n = meta['width']
    for f in flights:
        assert f['metres'] <= sp.FLIGHT_M + 1 and f['seconds'] <= sp.FLIGHT_S + 1
        assert all(0 <= x < n and 0 <= y < n for x, y in f['waypoints'])
    for a, b in itertools.pairwise(flights):
        assert b['waypoints'][0] == a['waypoints'][-1]  # each lands where the next takes off


def test_plan_ignores_hidden_rocks(tmp_path):
    world = tmp_path / 'w'
    shutil.copytree(WORLDS[0], world)
    before = sp.plan(str(world))[1]
    (world / 'rocks_fine.u8').write_bytes(bytes(len((world / 'rocks_fine.u8').read_bytes())))
    assert sp.plan(str(world))[1] == before


def test_committed_plan_matches_contract():
    for world in WORLDS:
        path = world / 'scout_plan.json'
        if path.exists():
            for f in json.loads(path.read_text()):
                assert {'flight', 'waypoints', 'seconds', 'metres', 'cells_revealed'} <= set(f)
