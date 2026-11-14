# Map grows demonstration

In E6 Walk mode, choose **Download walk log**. Pass that JSONL file to
`merge_walk.py` with the same source world you walked in. The pipeline
accepts E6's session header and app-state ticks, then merges the five kinds
of cell observations. It rejects a session header from a different site.

The next walk can load the updated world using
`?world=walk-demo&flags=map_grows`. The minimap marks contributed cells in
magenta. Expand **Walk observations** to see counts, a recorded effort
comparison when available, and a download of the merged observations. The
base world continues to show NASA source layers and derived
walking-safety costs. Walk observations remain linked to their logged cell and
time, with the original value and any units supplied by the logger.

From the repository root, run this synthetic example:

```bash
cat > /tmp/marswalk-demo.jsonl <<'JSONL'
{"walk":"synthetic","started":"2026-11-14T23:50:00.000Z","stops":[],"flags":["science_stop"]}
{"t":0,"astronaut":{"x":64,"y":64},"energy_left_j":250000}
{"cell":[64,66],"kind":"effort","value":{"predicted_j":100,"measured_j":140},"time":8}
{"cell":[67,66],"kind":"ground","value":3,"time":10}
{"cell":[67,66],"kind":"marker","value":"Sand starts here","time":11}
JSONL
python3 data/pipeline/merge_walk.py data/worlds/synthetic /tmp/marswalk-demo.jsonl data/worlds/walk-demo --map-grows
python3 data/pipeline/check_world.py data/worlds/walk-demo
```

Open `?world=synthetic&flags=map_grows` first: there are no contributed cells.
Open `?world=walk-demo&flags=map_grows` next: there are two contributed cells.
The first has a synthetic logged effort of 140 J against 100 J predicted, a
40% difference. These example measurements are for the demonstration.
