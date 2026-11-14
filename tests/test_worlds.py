"""World files are the contract every lane reads (docs/CONTRACTS.md section 1). Keep a broken one off main."""
import array
import importlib.util
import os
import pathlib
import re
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('check_world', ROOT / 'data/pipeline/check_world.py')
cw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cw)

WORLDS = cw.world_folders(ROOT / 'data/worlds')


@pytest.mark.parametrize('folder', WORLDS, ids=[os.path.basename(f) for f in WORLDS])
def test_world_meets_contract(folder):
    assert cw.check(folder) == []


def test_synthetic_world_is_up_to_date(tmp_path):
    """Committed synthetic world == what make_world.py writes now. Fix: python3 data/pipeline/make_world.py"""
    fresh = tmp_path / 'synthetic'
    subprocess.run([sys.executable, str(ROOT / 'data/pipeline/make_world.py'), '--out', str(fresh)],
                   check=True, capture_output=True)
    committed = ROOT / 'data/worlds/synthetic'
    assert sorted(os.listdir(fresh)) == sorted(os.listdir(committed))
    for name in os.listdir(fresh):
        a, b = (fresh / name).read_bytes(), (committed / name).read_bytes()
        if a == b:
            continue
        # ponytail: libm (exp, atan) may differ by 1 ulp across OSes; allow that on float layers only.
        assert name.endswith('.f32'), f'{name} is stale: run python3 data/pipeline/make_world.py'
        x, y = array.array('f', a), array.array('f', b)
        assert len(x) == len(y) and all(abs(p - q) <= 1e-5 * max(abs(p), abs(q), 1.0) for p, q in zip(x, y)), \
            f'{name} is stale: run python3 data/pipeline/make_world.py'


def test_checker_catches_a_broken_world(tmp_path):
    bad = tmp_path / 'bad'
    shutil.copytree(ROOT / 'data/worlds/synthetic', bad)
    with open(bad / 'slope.f32', 'ab') as f:
        f.write(b'\0\0\0\0')  # one cell too many
    ctg = array.array('f', (bad / 'cost_to_go.f32').read_bytes())
    ctg[0] = float('nan')
    (bad / 'cost_to_go.f32').write_bytes(ctg.tobytes())
    problems = cw.check(str(bad))
    assert any(p.startswith('slope.f32') for p in problems)
    assert any(p.startswith('cost_to_go.f32') for p in problems)


def _git_files(*paths):
    try:
        out = subprocess.run(['git', 'ls-files', '-z', *paths], cwd=ROOT, capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        pytest.skip('not a git checkout')
    return [p for p in out.stdout.decode().split('\0') if p]


def test_no_raw_data_or_big_files_committed():
    files = _git_files('data')
    assert not [f for f in files if f.startswith('data/raw/')], 'data/raw/ is for downloads; never commit it'
    big = [f for f in files if os.path.exists(ROOT / f) and os.path.getsize(ROOT / f) > 2 * 1024 * 1024]
    assert not big, f'files over 2 MB under data/: {big}. Commit only small world folders.'


# Contract v1 world files. Add new names to CONTRACTS.md freely; removing or renaming one fails here.
V1_FILES = {'world.json', 'height.f32', 'slope.f32', 'terrain_class.u8', 'cost_per_m.f32', 'cost_to_go.f32',
            'optical.png', 'thermal_inertia.f32', 'science.u8', 'dose_rate.f32', 'rocks_fine.u8', 'scout_plan.json',
            'cost_to_go_scouted.f32', 'targets.json', 'stops.json', 'route.json'}


def test_contract_world_files_never_renamed_or_removed():
    text = (ROOT / 'docs/CONTRACTS.md').read_text()
    section = text.split('## 1.')[1].split('\n## ')[0]
    listed = set(re.findall(r'^\| `([\w.]+)` \|', section, re.MULTILINE))
    assert V1_FILES <= listed, f'CONTRACTS.md section 1 dropped or renamed {sorted(V1_FILES - listed)}'
    assert set(cw.REQUIRED_FILES) <= listed
