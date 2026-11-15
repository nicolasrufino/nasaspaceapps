import json
from pathlib import Path

import pytest

from data.pipeline import merge_walk
from data.pipeline.merge_walk import LOG, merge

WORLD = Path(__file__).resolve().parents[1] / 'data/worlds/synthetic'


def test_concurrent_destination_is_preserved(tmp_path, monkeypatch):
    """A publisher winning after the initial check must never be overwritten."""
    walk = tmp_path / 'walk.jsonl'
    walk.write_text(json.dumps({'cell': [2, 2], 'kind': 'marker', 'time': 1, 'value': 'flag'}))
    destination = tmp_path / 'next'
    original_check = merge_walk.check

    def concurrent_publish(folder):
        errors = original_check(folder)
        if folder != WORLD.resolve():
            destination.mkdir()
            (destination / 'other-owner.txt').write_text('preserve this world')
        return errors

    monkeypatch.setattr(merge_walk, 'check', concurrent_publish)
    with pytest.raises(OSError):
        merge(WORLD, walk, destination)
    assert [p.name for p in destination.iterdir()] == ['other-owner.txt']
    assert (destination / 'other-owner.txt').read_text() == 'preserve this world'


def test_merges_all_kinds_preserves_world_and_deduplicates(tmp_path):
    records = [{'cell': [2, 2], 'time': 1, 'kind': kind, 'value': value}
               for kind, value in [
                   ('photo', 'crew.jpg'), ('ground', 3), ('effort', {'value': 140, 'units': 'J'}),
                   ('marker', 'flag'), ('sample', 'S-01'),
               ]]
    walk = tmp_path / 'walk.jsonl'
    walk.write_text('\n'.join(map(json.dumps, records)))
    destination = tmp_path / 'next'
    assert merge(WORLD, walk, destination) == 5
    assert [json.loads(line) for line in (destination / LOG).read_text().splitlines()] == records
    for original in WORLD.iterdir():
        assert original.read_bytes() == (destination / original.name).read_bytes()
    assert merge(destination, walk, tmp_path / 'again') == 0
    with pytest.raises(ValueError, match='new directory'):
        merge(WORLD, walk, destination)


@pytest.mark.parametrize('record', [
    {},
    {'cell': [999, 1], 'kind': 'marker', 'time': 0, 'value': 'outside'},
    {'cell': [True, 1], 'kind': 'marker', 'time': 0, 'value': 'invalid'},
    {'cell': [0, 1], 'kind': 'ground', 'time': 0, 'value': 5},
    {'cell': [0, 1], 'kind': 'effort', 'time': 0, 'value': float('nan')},
])
def test_rejects_invalid_input_without_publishing(tmp_path, record):
    walk = tmp_path / 'walk.jsonl'
    walk.write_text(json.dumps(record))
    destination = tmp_path / 'next'
    with pytest.raises(ValueError, match='walk.jsonl:1'):
        merge(WORLD, walk, destination)
    assert not destination.exists()


def test_e6_export_accepts_session_header_and_keeps_sample_context(tmp_path):
    data = [
        {'walk': 'synthetic', 'started': '2026-11-14T23:45:00.000Z', 'stops': ['target-1'], 'flags': ['science_stop']},
        {'t': 0, 'astronaut': {'x': 2, 'y': 2}, 'energy_left_j': 250000},
        {'cell': [2, 2], 'kind': 'photo', 'value': {'stop': 'target-1', 'image_url': None}, 'time': 10},
        {'cell': [2, 2], 'kind': 'sample', 'value': {
            'stop': 'target-1', 'name': 'Target 1', 'goal': None, 'layers': {'height': 10}, 'photo': None, 'time': 10,
        }, 'time': 10},
    ]
    log = tmp_path / 'synthetic-walk.jsonl'
    log.write_text('\n'.join(map(json.dumps, data)) + '\n')
    next_world = tmp_path / 'next'
    assert merge(WORLD, log, next_world) == 2
    assert [json.loads(line) for line in (next_world / LOG).read_text().splitlines()] == data[2:]
    data[0]['walk'] = 'gale'
    log.write_text('\n'.join(map(json.dumps, data)))
    with pytest.raises(ValueError, match="walk belongs to 'gale'"):
        merge(WORLD, log, tmp_path / 'wrong-site')
