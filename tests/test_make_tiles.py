"""Detail tiles (data/pipeline/make_tiles.py): same datum as the world grid, and seamless edges."""
import importlib.util
import json
import pathlib

import numpy as np
import pytest

rasterio = pytest.importorskip('rasterio')
pytest.importorskip('PIL')
from rasterio.transform import from_origin

ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('make_tiles', ROOT / 'data/pipeline/make_tiles.py')
mt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mt)


def test_tiles_match_the_world_and_join(tmp_path):
    raw, world, out = tmp_path / 'raw', tmp_path / 'world', tmp_path / 'tiles'
    raw.mkdir()
    world.mkdir()
    yy, xx = np.mgrid[0:64, 0:64]
    h = (-3900 + 0.3 * xx + 5 * np.sin(yy / 5)).astype('float32')
    prof = {'driver': 'GTiff', 'width': 64, 'height': 64, 'count': 1, 'dtype': 'float32',
            'transform': from_origin(0, 0, 1, 1)}
    with rasterio.open(raw / 'dem_1m.tif', 'w', **prof) as d:
        d.write(h, 1)
    with rasterio.open(raw / 'ortho_25cm.tif', 'w', **{**prof, 'width': 256, 'height': 256, 'count': 3,
                                                        'dtype': 'uint8', 'transform': from_origin(0, 0, .25, .25)}) as d:
        d.write(np.full((3, 256, 256), 120, 'uint8'))
    offset = float(h.min())
    h8 = h.reshape(8, 8, 8, 8).mean(axis=(1, 3)) - offset
    (world / 'world.json').write_text(json.dumps({'name': 't', 'width': 8, 'cell_size_m': 8.0, 'height_offset_m': offset}))
    m, _ = mt.make(str(raw), str(world), str(out), tile_m=32)
    assert m['tiles'] == 2 and m['height_px'] == 33 and m['app_offset_m'] == -4.0
    big = np.zeros((64, 64))
    for ty in range(2):
        for tx in range(2):
            t = np.fromfile(out / 'h' / f'{ty}_{tx}.u16', '<u2').reshape(33, 33)
            big[ty * 32:(ty + 1) * 32, tx * 32:(tx + 1) * 32] = m['height_base_m'] + t[:32, :32] / 100
    assert np.abs(big.reshape(8, 8, 8, 8).mean(axis=(1, 3)) - h8).max() < 0.01  # same datum as height.f32
    a = np.fromfile(out / 'h' / '0_0.u16', '<u2').reshape(33, 33)
    b = np.fromfile(out / 'h' / '0_1.u16', '<u2').reshape(33, 33)
    assert np.array_equal(a[:, 32], b[:, 0])  # shared edge: no gap between meshes
