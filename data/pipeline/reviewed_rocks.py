"""Reviewed rocks for the map (ticket F6): the human-accepted ROSCO rocks from ml/exports/rocks.json (Jules, R3),
placed in the app's frame so the Hazards view can pin them.

    python3 data/pipeline/reviewed_rocks.py      # -> data/worlds/gale/reviewed_rocks.json (needs data/raw/gale)

Source: NASA/JPL ROSCO rock detections on MRO HiRISE ESP_019698_1750, reviewed by a person (ml/rock_review/R3.md),
registered to the USGS MSL Gale mosaic. Points are where the rock was detected; the clearance cells around each
are already blocked in rocks_fine.u8. Only accepted points; uncertain and rejected ones are left out.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')


def to_app(points, box_west, box_north, app_offset):
    """Projected metres (east, north) -> app x (east), z (south), as the 3D view places cell centres."""
    out = []
    for p in points:
        e, n = p['registered_world_projected_m']
        out.append({'id': p['id'], 'cell': p['cell'],
                    'x': round(e - box_west + app_offset, 2), 'z': round(box_north - n + app_offset, 2)})
    return out


def main():
    import rasterio
    with open(os.path.join(ROOT, 'ml', 'exports', 'rocks.json')) as f:
        report = json.load(f)
    with open(os.path.join(WORLD, 'world.json')) as f:
        meta = json.load(f)
    with rasterio.open(os.path.join(RAW, 'dem_1m.tif')) as d:
        west, north = d.bounds.left, d.bounds.top
    pts = to_app(report['accepted_points'], west, north, -meta['cell_size_m'] / 2)
    out = {'what': 'Human-reviewed rocks (accepted ROSCO detections), app frame: x east, z south, metres',
           'made_by': 'data/pipeline/reviewed_rocks.py', 'from': 'ml/exports/rocks.json',
           'source': 'NASA/JPL ROSCO on MRO HiRISE ESP_019698_1750, human-reviewed (R3)',
           'review_counts': report['review_counts'], 'points': pts}
    with open(os.path.join(WORLD, 'reviewed_rocks.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{len(pts)} reviewed rocks -> reviewed_rocks.json')


if __name__ == '__main__':
    main()
