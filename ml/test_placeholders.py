"""R2 delivery must include both loadable models, not a vacuous zero-model pass."""
import hashlib
import json

import numpy as np
import pytest

ort = pytest.importorskip("onnxruntime")
pytest.importorskip("onnx")

from ml.check_exports import EXPORTS, SPECS, check
from ml.export_placeholders import export


def test_both_published_contract_models_exist_and_run():
    names, errors = check()
    assert set(names) == set(SPECS)
    assert errors == []


def test_reproduction_and_input_independent_behavior(tmp_path):
    export(tmp_path)
    rng = np.random.default_rng(2026)
    for name, (inputs, outputs) in SPECS.items():
        path = tmp_path / f"{name}.onnx"
        metadata = json.loads(path.with_suffix(".json").read_text())
        assert metadata["placeholder"] is True
        assert "held_out" not in metadata and "confusion_matrix" not in metadata
        assert metadata["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        input_name, input_shape = next(iter(inputs.items()))
        output_shape = next(iter(outputs.values()))
        want = np.zeros(output_shape, np.float32)
        want[0, 0] = 1
        for values in [np.zeros(input_shape, np.float32), rng.random(input_shape).astype(np.float32)]:
            got = session.run(None, {input_name: values})[0]
            np.testing.assert_array_equal(got, want)
        published = json.loads((EXPORTS / f"{name}.json").read_text())
        if published.get("placeholder"):
            assert path.read_bytes() == (EXPORTS / path.name).read_bytes()


def test_generator_refuses_to_replace_even_one_existing_export(tmp_path):
    model = tmp_path / "terrain_cls.onnx"
    model.write_bytes(b"a future trained model")
    with pytest.raises(FileExistsError):
        export(tmp_path)
    assert model.read_bytes() == b"a future trained model"
    assert not (tmp_path / "buddy_policy.onnx").exists()
