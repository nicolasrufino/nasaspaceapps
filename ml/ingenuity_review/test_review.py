import json

import pytest

from ml.ingenuity_review.evaluate import score, validate_review
from ml.ingenuity_review.prepare import parse_label, select_frames, sha


def test_selection_is_deterministic_distinct_and_spreads_sols():
    index = [{"sol": s, "url": f"https://example/{s}/", "labels": [f"{i}.xml" for i in range(7)]} for s in range(10)]
    a = select_frames(index)
    assert a == select_frames(list(reversed(index)))
    assert len({r["url"] for r in a}) == 50
    assert all(sum(r["sol"] == s for r in a) == 5 for s in range(10))
    with pytest.raises(ValueError):
        select_frames(index, 71)


def test_ground_truth_never_inferred_from_unknown_or_unreviewed():
    result = score([{"label": None, "prediction": "soil"}, {"label": "unknown", "prediction": "soil"}])
    assert result["accuracy"] is None and result["scored"] == 0
    result = score([{"label": "sand", "prediction": "unknown"}, {"label": "soil", "prediction": "soil"}])
    assert result["accuracy"] == .5
    assert result["recall"]["sand"] == 0
    assert result["recall"]["bedrock"] is None


def test_review_rejects_wrong_provenance_duplicate_ids_and_missing_reviewer():
    raw = json.dumps({"records": [{"id": "a"}, {"id": "b"}]}).encode()
    review = {"manifest_sha256": sha(raw), "reviewer": "human", "annotations": [{"id": "a", "label": None}, {"id": "b", "label": "sand"}]}
    assert validate_review(raw, review) == {"a": None, "b": "sand"}
    for altered in (dict(review, manifest_sha256="wrong"), dict(review, reviewer=""),
                    dict(review, annotations=[{"id": "a", "label": "sand"}]*2)):
        with pytest.raises(ValueError):
            validate_review(raw, altered)


@pytest.mark.parametrize("indirect", [False, True])
def test_pose_is_preserved_and_never_treated_as_altitude(indirect):
    reference = ("<Local_Internal_Reference><local_identifier_reference>G</local_identifier_reference></Local_Internal_Reference>" if indirect
                 else "<Coordinate_Space_Indexed><coordinate_space_frame_type>HELI_G_FRAME</coordinate_space_frame_type></Coordinate_Space_Indexed>")
    xml = f"""<Product_Observational>
    <File_Area_Observational_Supplemental><File><file_name>HSF_x.JPG</file_name></File></File_Area_Observational_Supplemental>
    <Coordinate_Space_Definition><local_identifier>G</local_identifier><Coordinate_Space_Present><Coordinate_Space_Indexed><coordinate_space_frame_type>HELI_G_FRAME</coordinate_space_frame_type></Coordinate_Space_Indexed></Coordinate_Space_Present></Coordinate_Space_Definition>
    <Coordinate_Space_Definition><Coordinate_Space_Present><Coordinate_Space_Indexed><coordinate_space_frame_type>HELI_M_FRAME</coordinate_space_frame_type><Coordinate_Space_Index><index_id>FLIGHT</index_id><index_value_number>3</index_value_number></Coordinate_Space_Index></Coordinate_Space_Indexed></Coordinate_Space_Present><Vector_Origin_Offset><x_position unit="m">0</x_position><y_position unit="m">1</y_position><z_position unit="m">-5.2</z_position></Vector_Origin_Offset><Coordinate_Space_Reference>{reference}</Coordinate_Space_Reference></Coordinate_Space_Definition></Product_Observational>"""
    parsed = parse_label(xml.encode())
    assert parsed["pose"]["flight"] == 3
    assert parsed["pose"]["origin_offset_m"][2] == -5.2
    assert parsed["height_agl_m"] is None
