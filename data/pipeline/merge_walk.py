"""Merge contracted walk-log observations into a new world for the next walk."""
import argparse
import json
import math
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

if __package__:
    from .check_world import check
else:
    from check_world import check

LOG = 'walk.jsonl'
KINDS = {'photo', 'ground', 'effort', 'marker', 'sample'}
FIELDS = {'cell', 'kind', 'value', 'time'}


def entries(path, metadata):
    with path.open(encoding='utf-8') as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
                if not isinstance(row, dict):
                    raise TypeError('expected a JSON object')
                if FIELDS.isdisjoint(row):
                    # E6 exports a session header followed by app-state ticks and observations.
                    if {'walk', 'started', 'stops', 'flags'} <= row.keys():
                        if row['walk'] != metadata.get('name'):
                            raise ValueError(f"walk belongs to {row['walk']!r}, expected {metadata.get('name')!r}")
                        datetime.fromisoformat(row['started'])
                        continue
                    if {'t', 'astronaut', 'energy_left_j'} <= row.keys():
                        continue
                    raise ValueError('expected a walk observation or app-state tick')
                if not FIELDS <= row.keys():
                    raise ValueError('missing observation fields')
                x, y = row['cell']
                if (not isinstance(row['cell'], list) or type(x) is not int or type(y) is not int
                        or not (0 <= x < metadata['width'] and 0 <= y < metadata['height'])):
                    raise ValueError('cell outside the world grid')
                kind, value, time = row['kind'], row['value'], row['time']
                if kind not in KINDS:
                    raise ValueError('unknown observation kind')
                if not (type(time) in (int, float) and math.isfinite(time) and time >= 0
                        or isinstance(time, str) and time.strip()):
                    raise ValueError('invalid time')
                if value is None or isinstance(value, bool):
                    raise ValueError('invalid observation value')
                if kind == 'ground' and type(value) is int and str(value) not in metadata['classes']:
                    raise ValueError('unknown ground class')
                if kind == 'effort' and type(value) in (float, int) and value <= 0:
                    raise ValueError('measured effort must be positive')
                # Keep producer values and units intact. Section 3 gives no per-kind value schema.
                yield json.dumps(row, allow_nan=False, sort_keys=True, separators=(',', ':'))
            except (ValueError, TypeError, OverflowError) as exc:
                raise ValueError(f'{path}:{line_number}: {exc}') from exc


def merge(source, walk, destination):
    source, destination = source.resolve(), destination.resolve()
    if (destination.exists() or destination.is_relative_to(source)
            or source.is_relative_to(destination)):
        raise ValueError('destination must be a new directory outside the source world')
    errors = check(source)
    if errors:
        raise ValueError('; '.join(errors))
    metadata = json.loads((source / 'world.json').read_text())
    prior = list(entries(source / LOG, metadata)) if (source / LOG).is_file() else []
    incoming = list(entries(walk, metadata))
    if not incoming:
        raise ValueError('walk has no observations')
    merged = list(dict.fromkeys(prior + incoming))
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        staged = Path(temporary) / 'world'
        shutil.copytree(source, staged)
        (staged / LOG).write_text('\n'.join(merged) + '\n', encoding='utf-8')
        errors = check(staged)
        if errors:
            raise ValueError('; '.join(errors))
        # Reserve the name without overwriting a world published by another invocation.
        destination.mkdir()
        try:
            staged.rename(destination)
        except OSError:
            destination.rmdir()
            raise
    return len(merged) - len(prior)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('walk', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--map-grows', action='store_true', help='Enable the map_grows feature')
    args = parser.parse_args()
    if not args.map_grows:
        parser.error('map_grows is disabled. Pass --map-grows to enable it.')
    try:
        count = merge(args.source, args.walk, args.destination)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(f'Added {count} observations to {args.destination}')
