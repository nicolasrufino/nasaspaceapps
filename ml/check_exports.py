"""Check every model in ml/exports/ against docs/CONTRACTS.md section 2.

    python ml/check_exports.py            # full check (needs onnx + onnxruntime)
    python ml/check_exports.py --no-onnx  # names, sizes, metrics JSON only (stdlib)

Passes with no exports. For each `<name>.onnx`:
- `<name>` is listed in CONTRACTS section 2 (SPECS below); new models go in the contract first.
- input/output names, float32 type and shapes match; one run on zeros gives the
  contract output shape with finite values (onnxruntime, CPU).
- size is at most MAX_MB (it loads on a phone).
- `<name>.json` sits next to it with:
    "data_source": "what it was trained/tested on" (string or list, non-empty)
    "held_out": {"accuracy": 0.87, ...}   numbers measured by code in this repo
  A placeholder (untrained, shape-only) model says "placeholder": true instead of
  "held_out", so no number is invented. terrain_cls also needs
  "confusion_matrix": 5x5 (rows = true class 0-4).
"""

import json
import math
import pathlib
import sys

EXPORTS = pathlib.Path(__file__).parent / 'exports'
MAX_MB = 50

# name -> ({input name: shape}, {output name: shape}); mirrors docs/CONTRACTS.md section 2.
SPECS = {
    'terrain_cls': ({'image': [1, 3, 128, 128]}, {'logits': [1, 5]}),
    'buddy_policy': ({'obs': [1, 27]}, {'action_logits': [1, 9]}),
}
N_CLASSES = 5


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def check_metrics(onnx_path):
    name, path = onnx_path.stem, onnx_path.with_suffix('.json')
    if not path.exists():
        return [f'{path.name} missing: every model needs a metrics JSON next to it']
    try:
        m = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        return [f'{path.name}: not valid JSON ({e})']
    if not isinstance(m, dict):
        return [f'{path.name}: must be a JSON object']
    errs = []
    src = m.get('data_source')
    if not src or not isinstance(src, (str, list)):
        errs.append(f'{path.name}: "data_source" (string or list) is required')
    if m.get('placeholder') is True:
        return errs
    held = m.get('held_out')
    if not isinstance(held, dict) or not held or not all(is_num(v) for v in held.values()):
        errs.append(f'{path.name}: "held_out" must be an object of numbers, e.g. {{"accuracy": 0.87}}'
                    ' (or set "placeholder": true for an untrained model)')
    if name == 'terrain_cls':
        cm = m.get('confusion_matrix')
        ok = (isinstance(cm, list) and len(cm) == N_CLASSES
              and all(isinstance(r, list) and len(r) == N_CLASSES and all(is_num(v) for v in r) for r in cm))
        if not ok:
            errs.append(f'{path.name}: "confusion_matrix" must be {N_CLASSES}x{N_CLASSES} numbers')
    return errs


def _shape_errs(where, value_info, want):
    import onnx
    t = value_info.type.tensor_type
    errs = []
    if t.elem_type != onnx.TensorProto.FLOAT:
        errs.append(f'{where}: type must be float32')
    dims = t.shape.dim
    if len(dims) != len(want):
        return errs + [f'{where}: rank {len(dims)}, contract shape is {want}']
    for i, (d, w) in enumerate(zip(dims, want)):
        if d.HasField('dim_value') and d.dim_value == w:
            continue
        if i == 0 and not d.HasField('dim_value'):
            continue  # dynamic batch is fine; the run below checks batch 1
        errs.append(f'{where}: dim {i} is {d.dim_value or d.dim_param or "?"}, contract shape is {want}')
    return errs


def check_model(onnx_path):
    import numpy as np
    import onnx
    import onnxruntime as ort

    ins, outs = SPECS[onnx_path.stem]
    try:
        model = onnx.load(str(onnx_path))
        onnx.checker.check_model(model)
    except Exception as e:  # noqa: BLE001 -- any load/run failure is a check failure
        return [f'{onnx_path.name}: not a valid ONNX model ({e})']
    g = model.graph
    init = {i.name for i in g.initializer}
    got_in = {v.name: v for v in g.input if v.name not in init}
    got_out = {v.name: v for v in g.output}
    errs = []
    for kind, got, want in (('input', got_in, ins), ('output', got_out, outs)):
        if set(got) != set(want):
            errs.append(f'{onnx_path.name}: {kind} names {sorted(got)}, contract says {sorted(want)}')
            continue
        for n, shape in want.items():
            errs += _shape_errs(f'{onnx_path.name} {kind} "{n}"', got[n], shape)
    if errs:
        return errs
    try:
        sess = ort.InferenceSession(str(onnx_path), providers=['CPUExecutionProvider'])
        feed = {n: np.zeros(s, np.float32) for n, s in ins.items()}
        res = dict(zip([o.name for o in sess.get_outputs()], sess.run(None, feed)))
    except Exception as e:  # noqa: BLE001 -- any load/run failure is a check failure
        return [f'{onnx_path.name}: onnxruntime failed to run it ({e})']
    for n, shape in outs.items():
        a = res[n]
        if list(a.shape) != shape or a.dtype != np.float32:
            errs.append(f'{onnx_path.name}: output "{n}" ran as {a.dtype}{list(a.shape)}, contract is float32{shape}')
        elif not np.isfinite(a).all():
            errs.append(f'{onnx_path.name}: output "{n}" has NaN/inf on a zero input')
    return errs


def check(exports=EXPORTS, run_onnx=True):
    """Return (list of checked model names, list of error strings)."""
    errs, names = [], []
    for p in sorted(pathlib.Path(exports).glob('*.onnx')):
        names.append(p.stem)
        if p.stem not in SPECS:
            errs.append(f'{p.name}: not in docs/CONTRACTS.md section 2; add it there (and to SPECS) first')
            continue
        mb = p.stat().st_size / 1e6
        if mb > MAX_MB:
            errs.append(f'{p.name}: {mb:.0f} MB, limit {MAX_MB} MB (it has to load on a phone)')
        errs += check_metrics(p)
        if run_onnx:
            errs += check_model(p)
    return names, errs


def main(argv):
    names, errs = check(run_onnx='--no-onnx' not in argv)
    for e in errs:
        print('FAIL', e)
    print(f'check_exports: {len(names)} model(s) {names}, {len(errs)} problem(s)')
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
