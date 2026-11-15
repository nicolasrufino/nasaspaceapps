import copy
import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from data.pipeline import check_world, make_world, scout_plan
from ml.rock_review.r3_alignment import local_checks
from ml.rock_review.r3_hazards import (
    BIG,
    export,
    positive_mask,
    read_array,
    resolve,
    scouted_cost,
    semantic_sha,
    sha,
    union_masks,
)

HERE = Path(__file__).parent


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")


def row(identity, cell, status="accepted"):
    registered = {"candidate_id": identity, "native_pixel": [1., 2.], "world_cell": cell,
                  "registered_world_projected_m": [12., 20.]}
    return {"id": identity, "detection_id": identity, "rock_point_px": [1., 2.],
            "registered": registered, "decision": status}


def test_complete_review_is_required_and_uncertainty_is_not_approval():
    candidates = {"annotations": [row("A", [2, 2]), row("B", [3, 3])]}
    review = {"reviews": [{"user_response_verbatim": "TEST FIXTURE", "decisions": [{"id": "A", "status": "uncertain"}]}]}
    with pytest.raises(ValueError, match="coverage is incomplete"):
        resolve(candidates, review)
    assert [r["decision"] for r in resolve(candidates, review, False)] == ["uncertain", "unreviewed"]
    for extra in ({"id": "A", "status": "accepted"}, {"id": "unknown", "status": "accepted"}):
        bad = copy.deepcopy(review)
        bad["reviews"][0]["decisions"].append(extra)
        with pytest.raises(ValueError, match="Unknown or duplicate"):
            resolve(candidates, bad, False)
    review["reviews"][0]["decisions"].append({"id": "B", "status": "probably"})
    with pytest.raises(ValueError, match="Unsupported"):
        resolve(candidates, review)


def test_mask_uses_only_accepted_points_with_clipped_clearance_and_no_removed_hazards():
    rows = [row("A", [0, 0]), row("B", [4, 3], "uncertain"), row("C", [4, 0], "rejected")]
    checks = [{"id": r["id"], "passed": True} for r in rows]
    mask, points = positive_mask(rows, checks, 5, 4)
    assert [i for i, v in enumerate(mask) if v] == [0, 1, 5, 6]
    assert [p["id"] for p in points] == ["A"]
    previous = bytes([0]*19+[1])
    merged = union_masks(previous, mask)
    assert sum(merged) == 5 and merged[19] == 1
    checks[0]["passed"] = False
    with pytest.raises(ValueError, match="failed local alignment"):
        positive_mask(rows, checks, 5, 4)
    with pytest.raises(ValueError, match="binary"):
        union_masks(b"\x02", b"\x00")


def test_return_cost_blocks_hazards_and_preserves_the_way_home():
    n, base = 7, [0, 3]
    meta = {"width": n, "height": n, "cell_size_m": 8, "base_cell": base,
            "energy_budget_j": 600000, "knobs": make_world.KNOBS, "gravity_mps2": make_world.G_MARS}
    h, cls = [0.]*49, [1]*49
    old = make_world.build(n, 8, base, 600000, h=h, cls=cls)[-1]
    blocked = bytearray(49)
    for y in range(1, 6):
        blocked[y*n+3] = 1
    raw = scouted_cost(meta, h, cls, blocked, old)
    costs = np.frombuffer(raw, "<f4")
    assert all(costs[i] >= BIG*.99 for i, b in enumerate(blocked) if b)
    assert costs[3*n+6] > old[3*n+6]
    path = make_world.path_home(costs, n, [6, 3])
    assert path[-1] == base and all(not blocked[y*n+x] for x, y in path)
    blocked[3*n] = 1
    with pytest.raises(ValueError, match="habitat"):
        scouted_cost(meta, h, cls, blocked, old)


def test_return_cost_obeys_directed_crossings_and_accepts_serialized_knobs():
    meta = {"width": 3, "height": 3, "cell_size_m": 8, "base_cell": [0, 1],
            "energy_budget_j": 3165180, "gravity_mps2": make_world.G_MARS,
            "knobs": {**make_world.KNOBS, "eta": [make_world.CLASSES[c][1] for c in range(5)],
                      "step_max_m": .3, "steep_run_m": 3., "lane_offset_m": 2.}}
    # Only the middle row can walk west to base. No eastbound edges exist.
    passable = bytearray(9)
    passable[4] = passable[5] = 1 << 3
    h, cls, blocked = [0.]*9, [1]*9, bytes(9)
    old = make_world.build(3, 8, [0, 1], meta["energy_budget_j"], h=h, cls=cls)[-1]
    costs = np.frombuffer(scouted_cost(meta, h, cls, blocked, old, passable=passable), "<f4")
    assert costs[3] == 0 and 0 < costs[4] < costs[5] < BIG*.99
    assert all(costs[i] >= BIG*.99 for i in (0, 1, 2, 6, 7, 8))
    assert make_world.path_home(costs, 3, [2, 1], passable=passable) == [[2, 1], [1, 1], [0, 1]]
    with pytest.raises(ValueError, match="requires passable"):
        scouted_cost(meta, h, cls, blocked, old)
    with pytest.raises(ValueError, match="passable layer size"):
        scouted_cost(meta, h, cls, blocked, old, passable=bytes(8))
    for key, value in (("eta", [1.]*5), ("gravity_energy_factor", .38), ("unhandled_energy_knob", 1)):
        bad = copy.deepcopy(meta)
        bad["knobs"][key] = value
        with pytest.raises(ValueError, match="energy model differs"):
            scouted_cost(bad, h, cls, blocked, old, passable=passable)


def test_local_check_uses_affine_in_correct_direction_and_rejects_bad_alignment():
    reference = np.random.default_rng(42).normal(100, 20, (2048, 2048)).astype(np.float32)
    matrix = np.array([[1., 0., 21.], [0., 1., -15.]])
    moving = cv2.warpAffine(reference, matrix, (2048, 2048))
    model = {"reference_to_native_matrix": matrix[:, :2], "reference_to_native_offset_m": matrix[:, 2]}
    candidate = row("EDGE", [0, 0])
    candidate["registered"]["registered_world_projected_m"] = [1968, 2048-112]
    result = local_checks(reference, moving, [candidate], model, [0, 0, 2048, 2048])
    assert result[0]["passed"]
    assert result[0]["signals"]["highpass"]["residual_m"] < 1
    model["reference_to_native_offset_m"] = [0., 0.]
    assert not local_checks(reference, moving, [candidate], model, [0, 0, 2048, 2048])[0]["passed"]


def fixture_bundle(tmp_path):
    """Entirely synthetic review; never written into the actual human decisions."""
    world, artifacts = tmp_path/"world", tmp_path/"artifacts"
    artifacts.mkdir()
    n, base, budget = 16, [1, 1], 600000
    make_world.write(str(world), n, 8, base, budget, *make_world.build(n, 8, base, budget, h=[0.]*(n*n), cls=[1]*(n*n)))
    meta = json.loads((world/"world.json").read_bytes())
    meta["site"] = {"name": "Synthetic test only"}
    meta["scout"] = {}
    write_json(world/"world.json", meta)
    _, flights, _ = scout_plan.plan(world)
    write_json(world/"scout_plan.json", flights)
    rows = [row("A", [12, 12]), row("B", [13, 6]), row("C", [4, 10])]
    write_json(artifacts/"registered_candidates.json", [r["registered"] for r in rows])
    write_json(artifacts/"registration_metrics.json", {
        "highpass_model": {"image_alignment_check_passed": True},
        "g_proximity_matches_after_registration": [], "g_review_counts": {}})
    candidates = {"annotations": rows, "source_pixel_sha256": "synthetic",
                  "registration_file_sha256": sha((artifacts/"registration_metrics.json").read_bytes()),
                  "registered_candidates_sha256": sha((artifacts/"registered_candidates.json").read_bytes())}
    write_json(artifacts/"r3_candidates.json", candidates)
    candidate_hash = sha((artifacts/"r3_candidates.json").read_bytes())
    write_json(artifacts/"r3_decisions.json", {"candidate_file_sha256": candidate_hash, "source_pixel_sha256": "synthetic",
        "reviews": [{"user_response_verbatim": "SYNTHETIC TEST FIXTURE ONLY", "decisions": [
            {"id": "A", "status": "accepted"}, {"id": "B", "status": "uncertain"}, {"id": "C", "status": "rejected"}]}]})
    write_json(artifacts/"r3_alignment.json", {"candidate_file_sha256": candidate_hash,
        "registration_file_sha256": candidates["registration_file_sha256"],
        "checks": [{"id": r["id"], "passed": True} for r in rows]})
    write_json(artifacts/"single_observation_source.json", {"pixel_sha256": "synthetic", "observation": "TEST", "source_url": "TEST"})
    write_json(artifacts/"r3_world_reference.json", {"world_semantic_sha256": semantic_sha(meta),
        "layer_sha256": {p.name: sha(p.read_bytes()) for p in world.iterdir() if p.suffix in (".u8", ".f32", ".png")}})
    return world, artifacts


def test_end_to_end_stages_valid_world_and_preserves_every_unrelated_file(tmp_path):
    world, artifacts = fixture_bundle(tmp_path)
    before = {p.name: p.read_bytes() for p in world.iterdir()}
    output = tmp_path/"output"
    report = export(world, output, artifacts=artifacts)
    assert report["review_counts"] == {"accepted": 1, "uncertain": 1, "rejected": 1}
    assert report["selected_proposal_agreement"]["fraction"] == .5
    assert report["reviewed_point_density"]["occupied_cells"] == [
        {"cell": [12, 12], "count": 1, "rocks_per_m2": 1/64}]
    assert report["precision"] is None and report["recall"] is None
    assert not check_world.check(str(output/"world"))
    changed = sorted(p.name for p in (output/"world").iterdir() if p.read_bytes() != before[p.name])
    assert changed == ["cost_to_go_scouted.f32", "rocks_fine.u8", "world.json"]
    assert all((world/name).read_bytes() == raw for name, raw in before.items())
    merged = (output/"rocks_fine.u8").read_bytes()
    assert all(not v or merged[i] for i, v in enumerate(before["rocks_fine.u8"]))
    assert sum((output/"rocks_verified.u8").read_bytes()) == 9
    assert len(read_array(output/"world/cost_to_go_scouted.f32", "f", 256)) == 256


def test_export_loads_and_pins_crossings(tmp_path):
    world, artifacts = fixture_bundle(tmp_path)
    meta = json.loads((world/"world.json").read_bytes())
    meta["files"]["passable"] = "passable.u8"
    write_json(world/"world.json", meta)
    # No crossing leaves the last cell, despite its flat, unblocked terrain.
    crossings = bytes([255]*255+[0])
    (world/"passable.u8").write_bytes(crossings)
    reference = json.loads((artifacts/"r3_world_reference.json").read_bytes())
    reference["world_semantic_sha256"] = semantic_sha(meta)
    write_json(artifacts/"r3_world_reference.json", reference)
    with pytest.raises(ValueError, match="missing from the world reference"):
        export(world, tmp_path/"unpinned", artifacts=artifacts)
    reference["layer_sha256"]["passable.u8"] = sha(crossings)
    write_json(artifacts/"r3_world_reference.json", reference)
    export(world, tmp_path/"crossings", artifacts=artifacts)
    assert read_array(tmp_path/"crossings/world/cost_to_go_scouted.f32", "f", 256)[255] >= BIG*.99
    assert (tmp_path/"crossings/world/passable.u8").read_bytes() == crossings
    (world/"passable.u8").write_bytes(bytes([255]*256))
    with pytest.raises(ValueError, match="Target world layer changed: passable"):
        export(world, tmp_path/"tampered", artifacts=artifacts)


@pytest.mark.parametrize("tamper", ["review", "pixels", "coordinates", "world"])
def test_export_rejects_stale_or_mixed_provenance(tmp_path, tamper):
    world, artifacts = fixture_bundle(tmp_path)
    if tamper == "world":
        (world/"height.f32").write_bytes(bytes(256*4))  # same here; change one value instead
        raw = bytearray((world/"height.f32").read_bytes())
        raw[3] = 1
        (world/"height.f32").write_bytes(raw)
    else:
        filename = "r3_candidates.json" if tamper == "coordinates" else "r3_decisions.json"
        obj = json.loads((artifacts/filename).read_bytes())
        if tamper == "review":
            obj["candidate_file_sha256"] = "stale"
        elif tamper == "pixels":
            obj["source_pixel_sha256"] = "another acquisition"
        else:
            obj["annotations"][0]["registered"]["world_cell"] = [1, 1]
        write_json(artifacts/filename, obj)
    with pytest.raises(ValueError):
        export(world, tmp_path/"out", artifacts=artifacts)
    assert not (tmp_path/"out").exists()


def test_preview_cannot_stage_a_world_with_missing_human_decisions(tmp_path):
    world, artifacts = fixture_bundle(tmp_path)
    path = artifacts/"r3_decisions.json"
    review = json.loads(path.read_bytes())
    review["reviews"][0]["decisions"].pop()
    write_json(path, review)
    with pytest.raises(ValueError, match="coverage is incomplete"):
        export(world, tmp_path/"final", artifacts=artifacts)
    report = export(world, tmp_path/"preview", preview=True, artifacts=artifacts)
    assert report["status"] == "incomplete_preview" and report["review_counts"]["unreviewed"] == 1
    assert not (tmp_path/"preview/world").exists()
    delivered = export(world, tmp_path/"reviewed-only", artifacts=artifacts, reviewed_only=True)
    assert delivered["review_complete"] is False
    assert delivered["review_counts"]["unreviewed"] == 1
    assert [p["id"] for p in delivered["accepted_points"]] == ["A"]
    assert not check_world.check(str(tmp_path/"reviewed-only/world"))


def test_frozen_h01_h06_remain_exactly_the_previously_reviewed_points():
    new_bytes = (HERE/"r3_candidates.json").read_bytes()
    candidates = json.loads(new_bytes)
    decisions = json.loads((HERE/"r3_decisions.json").read_bytes())
    old = json.loads((HERE/"rosco_confidence_review.json").read_bytes())
    previous = json.loads((HERE/"rosco_confidence_decisions.json").read_bytes())
    assert decisions["candidate_file_sha256"] == sha(new_bytes)
    assert decisions["reviews"][:len(previous["reviews"])] == previous["reviews"]
    assert len(candidates["annotations"]) == 25
    for a, b in zip(candidates["annotations"], old["annotations"]):
        assert all(a[k] == b[k] for k in ("id", "detection_id", "rock_point_px", "shadow_centroid_px"))
    for filename, key in (("registration_metrics.json", "registration_file_sha256"),
                          ("registered_candidates.json", "registered_candidates_sha256")):
        assert candidates[key] == sha((HERE/filename).read_bytes())


def test_published_gale_layer_matches_reviewed_points_and_manifest():
    root = HERE.parents[1]
    report = json.loads((root/"ml/exports/rocks.json").read_bytes())
    world = root/"data/worlds/gale"
    meta = json.loads((world/"world.json").read_bytes())
    for filename, expected in report["artifact_sha256"].items():
        assert sha((HERE/filename).read_bytes()) == expected
    candidates = json.loads((HERE/"r3_candidates.json").read_bytes())
    decisions = json.loads((HERE/"r3_decisions.json").read_bytes())
    checks = json.loads((HERE/"r3_alignment.json").read_bytes())["checks"]
    positive, points = positive_mask(resolve(candidates, decisions, complete=False), checks, meta["width"], meta["height"])
    assert points == report["accepted_points"]
    assert sum(r["count"] for r in report["reviewed_point_density"]["occupied_cells"]) == len(points)
    assert sha(positive) == report["files"]["rocks_verified.u8"]["sha256"]
    combined = (world/"rocks_fine.u8").read_bytes()
    assert sha(combined) == report["files"]["rocks_fine.u8"]["sha256"]
    assert all(not v or combined[i] for i, v in enumerate(positive))
    assert sum(combined) == report["combined_cells"] == report["existing_dtm_cells"]+report["added_cells"]
    assert meta["site"] == report["site"]
    assert {k: meta[k] for k in report["grid"]} == report["grid"]
    assert sha((world/"cost_to_go_scouted.f32").read_bytes()) == report["staged_world"]["cost_to_go_scouted_sha256"]
    reference = json.loads((HERE/"r3_world_reference.json").read_bytes())
    for filename, expected in reference["layer_sha256"].items():
        # Changes to unrelated NASA layers/metadata do not invalidate rock
        # labels. Changes to imagery, terrain or geometry require rechecking.
        if filename in ("height.f32", "slope.f32", "terrain_class.u8", "optical.png", "passable.u8"):
            assert sha((world/filename).read_bytes()) == expected
    size = meta["width"]*meta["height"]
    current = read_array(world/"cost_to_go_scouted.f32", "f", size)
    rebuilt = scouted_cost(meta, read_array(world/"height.f32", "f", size),
                           read_array(world/"terrain_class.u8", "B", size), combined, current,
                           passable=read_array(world/"passable.u8", "B", size))
    assert sha(rebuilt) == report["staged_world"]["cost_to_go_scouted_sha256"]
    assert all(cost >= BIG*.99 for cost, hazard in zip(current, combined) if hazard)
