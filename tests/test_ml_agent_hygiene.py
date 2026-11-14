"""No weights, datasets, big files or secrets in ml/ and agent/ (stdlib, runs in every CI job).

Looks at tracked files plus untracked files that are not ignored, so it also
catches a checkpoint before it is committed. Repo-wide secret scanning is a
separate check; this one only guards Person 1's folders.
"""

import pathlib
import re
import subprocess

import pytest

ROOT = pathlib.Path(__file__).parents[1]
LANES = ['ml', 'agent']
WEIGHTS = {'.pt', '.pth', '.ckpt', '.safetensors', '.bin', '.h5', '.keras', '.pkl', '.pickle', '.joblib',
           '.npy', '.npz', '.tflite', '.pb', '.zip', '.tar', '.gz', '.tgz', '.f32', '.u8', '.parquet'}
MAX_FILE_MB = 5  # ONNX exports are capped separately (ml/check_exports.py MAX_MB)
SECRET = re.compile(
    r'''(?ix)
    (key|secret|token|password|passwd|connection_string)\w*["']?\s*[:=]\s*["'][^"'\s$<{]{16,}["']
    | accountkey=[a-z0-9+/=]{20,}
    | -----begin[ a-z]*private\ key-----
    | \bsk-[a-z0-9_-]{20,}
    ''')


def lane_files():
    try:
        out = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', *LANES],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip('not a git checkout')
    return [ROOT / f for f in out.splitlines() if (ROOT / f).is_file()]


def test_no_weights_or_datasets():
    bad = [str(p.relative_to(ROOT)) for p in lane_files() if p.suffix.lower() in WEIGHTS]
    assert not bad, f'weights/datasets do not go in git (use ml/data/ or ml/runs/, git-ignored): {bad}'


def test_no_big_files():
    bad = [f'{p.relative_to(ROOT)} {p.stat().st_size / 1e6:.1f} MB' for p in lane_files()
           if p.suffix != '.onnx' and p.stat().st_size > MAX_FILE_MB * 1e6]
    assert not bad, f'files over {MAX_FILE_MB} MB: {bad}'


def test_no_env_files_or_literal_secrets():
    files = lane_files()
    envs = [str(p.relative_to(ROOT)) for p in files
            if p.name.startswith('.env') and p.name not in ('.env.example', '.env.sample')]
    assert not envs, f'.env files must not be committed (keys come from the environment): {envs}'
    hits = []
    for p in files:
        if p.suffix == '.onnx' or p.stat().st_size > 1e6:
            continue
        try:
            text = p.read_text()
        except UnicodeDecodeError:
            continue
        hits += [f'{p.relative_to(ROOT)}:{text.count(chr(10), 0, m.start()) + 1}' for m in SECRET.finditer(text)]
    assert not hits, f'looks like a hard-coded secret; read it from the environment instead: {hits}'
