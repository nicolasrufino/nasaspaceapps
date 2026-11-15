"""Run R5 against the same JavaScript implementation used by the phone app."""
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).parents[2]


def run_node(*arguments):
    node = shutil.which("node")
    assert node, "R5 checks require Node.js 24; CI installs it explicitly"
    result = subprocess.run([node, *arguments], cwd=ROOT, capture_output=True, text=True, timeout=90, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


def test_pitch_metric_semantics_and_gale_end_to_end():
    run_node("--test", "ml/pitch_metrics/metrics.test.mjs")


def test_committed_pitch_numbers_reproduce_from_current_inputs():
    run_node("ml/pitch_metrics/run.mjs", "--check")
