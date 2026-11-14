"""ml/exports/ matches docs/CONTRACTS.md section 2 (ml/check_exports.py).

The metrics/name checks are stdlib and run in every CI job. The ONNX checks need
`pip install -r ml/requirements-ci.txt` and are skipped without it.
"""

import importlib.util
import json
import pathlib

import pytest

spec = importlib.util.spec_from_file_location('check_exports', pathlib.Path(__file__).parents[1] / 'ml/check_exports.py')
ce = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ce)


def test_repo_exports_names_sizes_and_metrics():
    _, errs = ce.check(run_onnx=False)
    assert not errs, '\n'.join(errs)


def test_repo_exports_run_with_contract_shapes():
    pytest.importorskip('onnxruntime')
    _, errs = ce.check()
    assert not errs, '\n'.join(errs)


def _write(tmp, name, metrics, data=b'x'):
    (tmp / f'{name}.onnx').write_bytes(data)
    if metrics is not None:
        (tmp / f'{name}.json').write_text(json.dumps(metrics))


def test_metrics_rules(tmp_path):
    ok = {'data_source': 'AI4Mars', 'held_out': {'accuracy': 0.8}, 'confusion_matrix': [[1] * 5] * 5}
    _write(tmp_path, 'terrain_cls', ok)
    _write(tmp_path, 'buddy_policy', {'data_source': 'synthetic world', 'placeholder': True})
    assert ce.check(tmp_path, run_onnx=False)[1] == []

    _write(tmp_path, 'terrain_cls', {**ok, 'confusion_matrix': [[1] * 4] * 4})
    _write(tmp_path, 'buddy_policy', {'data_source': 'x', 'held_out': {'accuracy': None}})
    _write(tmp_path, 'mystery', {'data_source': 'x', 'placeholder': True})
    (tmp_path / 'lonely.onnx').write_bytes(b'x')
    errs = ce.check(tmp_path, run_onnx=False)[1]
    assert len(errs) == 4, errs
    (tmp_path / 'mystery.onnx').unlink()
    (tmp_path / 'lonely.onnx').unlink()
    (tmp_path / 'buddy_policy.json').unlink()
    assert any('buddy_policy.json missing' in e for e in ce.check(tmp_path, run_onnx=False)[1])


def _policy(out_dim, in_name='obs', batch=1):
    pytest.importorskip('onnx')
    import numpy as np
    from onnx import TensorProto, helper, numpy_helper

    w = numpy_helper.from_array(np.zeros((27, out_dim), np.float32), 'w')
    g = helper.make_graph(
        [helper.make_node('MatMul', [in_name, 'w'], ['action_logits'])], 'p',
        [helper.make_tensor_value_info(in_name, TensorProto.FLOAT, [batch, 27])],
        [helper.make_tensor_value_info('action_logits', TensorProto.FLOAT, [batch, out_dim])], [w])
    m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)])
    m.ir_version = 8
    return m.SerializeToString()


@pytest.mark.parametrize('model_kw, ok', [
    ({'out_dim': 9}, True),
    ({'out_dim': 9, 'batch': 'batch'}, True),  # dynamic batch allowed
    ({'out_dim': 8}, False),                   # wrong action count
    ({'out_dim': 9, 'in_name': 'x'}, False),   # wrong input name
])
def test_onnx_shape_check(tmp_path, model_kw, ok):
    pytest.importorskip('onnxruntime')
    _write(tmp_path, 'buddy_policy', {'data_source': 'synthetic', 'placeholder': True}, _policy(**model_kw))
    errs = ce.check(tmp_path)[1]
    assert (errs == []) == ok, errs
