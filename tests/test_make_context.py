"""Horizon rings (data/pipeline/make_context.py): the shading helper (no network)."""
import importlib.util
import pathlib

import numpy as np
import pytest

pytest.importorskip('PIL')
ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('make_context', ROOT / 'data/pipeline/make_context.py')
mc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mc)


def test_shaded_lights_slopes_facing_the_sun():
    _yy, xx = np.mgrid[0:32, 0:32].astype(float)
    west_facing = xx * 5.0  # height rises to the east: the slope faces west, toward the north-west sun
    east_facing = -xx * 5.0
    a, b = mc.shaded(west_facing, 16), mc.shaded(east_facing, 16)
    assert a.shape == (32, 32, 3) and a.dtype == np.uint8
    assert a[16, 16].sum() > b[16, 16].sum()
