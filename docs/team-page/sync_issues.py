# ponytail: one-off sync of docs/BUILD.md blocks into issue bodies and assignees; rerunnable (replaces its own marked section)
import json
import re
import subprocess
import sys
from pathlib import Path

R = sys.argv[1]
rows = re.findall(r'^\| ([A-Z]\d) \| (.*?) \| (P1|P2|P3|PX) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$', Path(f'{R}/docs/BUILD.md').read_text(encoding='utf-8'), re.MULTILINE)
B = {i: {'title': t, 'lane': l, 'when': w, 'what': wh, 'needs': [n.strip() for n in nd.split(',') if n.strip() not in ('—', '')], 'issues': re.findall(r'#(\d+)', iss)} for i, t, l, w, wh, nd, iss in rows}
deps = {}
for k, b in B.items():
    for n in b['needs']:
        deps.setdefault(n, []).append(k)
owner = {'P1': ('Jules (P1)', ['julesrumeautennis-cmd']), 'P2': ('Nicolas (P2)', ['nicolasrufino']), 'P3': ('Galsan (P3, lead)', ['Galsan2005'])}
xfall = {'X1': ['nicolasrufino'], 'X2': ['Galsan2005'], 'X3': ['Galsan2005'], 'X4': ['Galsan2005', 'nicolasrufino'], 'F4': ['Galsan2005', 'nicolasrufino']}
ref = lambda i: f"{i} {B[i]['title']}" + (f" ({', '.join('#'+x for x in B[i]['issues'])})" if B[i]['issues'] else '')
per = {}
for k, b in B.items():
    for n in b['issues']:
        per.setdefault(n, []).append(k)
for num, ids in sorted(per.items(), key=lambda x: int(x[0])):
    parts, who = [], set()
    for i in ids:
        b = B[i]
        if b['lane'] == 'PX':
            label = 'Person X (open). Until someone joins: ' + ' and '.join({'nicolasrufino': 'Nicolas', 'Galsan2005': 'Galsan'}[u] for u in xfall[i])
            who.update(xfall[i])
        else:
            label = owner[b['lane']][0]; who.update(owner[b['lane']][1])
        parts.append(f"**Block {i}: {b['title']}** · Owner: {label} · Phase: {b['when']}\n\n"
                     f"- **What goes in it:** {b['what']}\n"
                     f"- **Needs first:** {', '.join(ref(n) for n in b['needs']) or 'nothing, start now'}\n"
                     f"- **Unlocks:** {', '.join(ref(d) for d in deps.get(i, [])) or 'nothing else waits on it'}")
    sec = ("<!-- build-graph -->\n## In the build graph\n\n" + "\n\n".join(parts) +
           "\n\n**How we work**\n"
           "- Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/BUILD.md` and your brief in `docs/roles/` (agents too).\n"
           "- Build against `data/worlds/synthetic/` until the real Gale files land; the formats are in `docs/CONTRACTS.md`.\n"
           "- One branch per block (`yourname/what-it-does`), one PR that names the block, says `Closes #" + num + "` and lists what it unlocks; tell those owners.\n"
           "- Features sit behind a flag and stay off until stable; `main` always runs.\n"
           "- New idea? Grade it in `docs/CRITIQUE.md` first.\n"
           "<!-- /build-graph -->")
    body = subprocess.run(['gh', 'issue', 'view', '-R', 'nicolasrufino/nasaspaceapps', num, '--json', 'body', '-q', '.body'], capture_output=True, text=True, check=True).stdout.rstrip()
    body = re.sub(r'\n*<!-- build-graph -->.*?<!-- /build-graph -->', '', body, flags=re.DOTALL).rstrip()
    body = re.sub(r'^Block F\d \(details below\)\.$', '', body).strip()
    new = (body + "\n\n" if body else "") + sec
    cur = json.loads(subprocess.run(['gh', 'issue', 'view', '-R', 'nicolasrufino/nasaspaceapps', num, '--json', 'assignees'], capture_output=True, text=True, check=True).stdout)['assignees']
    cmd = ['gh', 'issue', 'edit', '-R', 'nicolasrufino/nasaspaceapps', num, '--body', new]
    for u in sorted(who - {a['login'] for a in cur}):
        cmd += ['--add-assignee', u]
    subprocess.run(cmd, capture_output=True, text=True, check=True)
    print(num, ids, sorted(who))
