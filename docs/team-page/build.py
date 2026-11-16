# ponytail: renders the repo's docs into one team page (needs pandoc).
# Run from anywhere: python3 docs/team-page/build.py .   -> writes docs/team-page/plan.html
# Then republish plan.html to the team page artifact (see docs/team-page/README.md).
import html
import os
import re
import subprocess
import sys
from pathlib import Path

H = os.path.dirname(os.path.abspath(__file__))  # this folder: templates live here
R = sys.argv[1]  # repo root
def md(path, shift=0):
    out = subprocess.run(['pandoc', '-f', 'gfm', '-t', 'html5', '--wrap=none', f'--shift-heading-level-by={shift}', path], capture_output=True, text=True, check=True).stdout
    out = re.sub(r'<a href="(http[^"]*)"', r'<a href="\1" target="_blank" rel="noopener"', out)
    out = out.replace('<table>', '<div class="tbl"><table>').replace('</table>', '</table></div>')
    return out
plan = md(f'{R}/docs/PLAN.md')
plan = re.sub(r'<h1[^>]*>.*?</h1>', '', plan, count=1, flags=re.DOTALL)  # page header replaces it
ids = ['summary', 'challenge', 'product', 'fit', 'layers', 'marswalk', 'safety', 'robots', 'why', 'stack', 'build', 'beforeafter', 'sources']
for i, h in zip(ids, re.findall(r'<h2[^>]*>.*?</h2>', plan)):
    plan = plan.replace(h, re.sub(r'<h2[^>]*>', f'<h2 id="{i}">', h), 1)
arch = '''<figure class="arch"><pre class="mermaid">
flowchart LR
  subgraph P3["Person 3: data"]
    DTM["NASA layers: HiRISE, THEMIS, CRISM, USGS, RAD"] --> MW["Pipeline"]
  end
  MW --> WF[("Site files: layers, targets,<br/>route, stops, cost home")]
  subgraph P1["Person 1: ML"]
    WF --> ENV["Grid env"] --> RL["Buddy rover PPO"]
    IMG["AI4Mars + Perseverance images"] --> CLS["Terrain classifier"]
  end
  RL --> ONNX[("ONNX models")]
  CLS --> ONNX
  subgraph P2["Person 2: phone"]
    APP["App: plan, walk, stop<br/>layers, ring, checklist"]
  end
  WF --> APP
  ONNX --> APP
  APP <-->|"state, 20 s delay"| CAP["CAPCOM agent<br/>Microsoft Foundry"]
</pre><figcaption>Everything meets at two shared formats: the world files and the ONNX models. That is why nobody waits on anybody.</figcaption></figure>'''
plan = re.sub(r'<h3 id="why-this-is-the-best-solution">', '<h3 id="best">', plan)
plan = plan.replace('<h2 id="build">', arch + '\n<h2 id="build">', 1)
roles = []
for f, cls in [('person-1-ml', 'p1'), ('person-2-engine', 'p2'), ('person-3-data-systems', 'p3'), ('person-x', 'px')]:
    h = md(f'{R}/docs/roles/{f}.md', shift=1)
    h = re.sub(r'<blockquote>\s*(.*?)\s*</blockquote>', lambda m: f'<div class="brief"><button type="button" class="copy">Copy agent brief</button><div class="brief-text">{m.group(1)}</div></div>', h, flags=re.DOTALL)
    roles.append(f'<article class="role {cls}" id="{cls}">{h}</article>')
research = md(f'{R}/docs/RESEARCH.md', shift=1)
research = re.sub(r'<h2[^>]*>Research: how surface exploration actually works</h2>', '', research)
research = re.sub(r'<h2([^>]*)>', r'<h3\1>', research).replace('</h2>', '</h3>')
pitch = md(f'{R}/docs/PITCH.md', shift=1)
pitch = re.sub(r'<h2[^>]*>The pitch \(draft \d+, Sat Nov 14\)</h2>', '', pitch)
screens = Path(os.path.join(H, 'screens.html')).read_text(encoding='utf-8').replace('{{WORLD64}}', Path(os.path.join(H, 'world64.json')).read_text(encoding='utf-8'))
codex = md(f'{R}/docs/CODEX.md', shift=1)
codex = re.sub(r'<h2[^>]*>Working with Codex</h2>', '', codex)
codex = re.sub(r'<blockquote>\s*(.*?)\s*</blockquote>', lambda m: f'<div class="brief"><button type="button" class="copy">Copy prompt</button><div class="brief-text">{m.group(1)}</div></div>', codex, flags=re.DOTALL)
critique = md(f'{R}/docs/CRITIQUE.md', shift=1)
critique = re.sub(r'<h2[^>]*>Critique: every idea, graded</h2>', '', critique)
critique = re.sub(r'<td><strong>(\d+)</strong></td>', r'<td class="score">\1</td>', critique)
critique = critique.replace('<strong>Keep', '<strong class="keep">Keep').replace('<strong>Cut', '<strong class="cut">Cut').replace('<strong>Simplify', '<strong class="simp">Simplify')
data = md(f'{R}/docs/DATA.md', shift=1)
data = re.sub(r'<h2[^>]*>NASA resources: what they are and how we use them</h2>', '', data)
data = data.replace('<strong>Use', '<strong class="keep">Use').replace("<strong>Don’t use", "<strong class=\"cut\">Don’t use").replace("<strong>Don't use", "<strong class=\"cut\">Don't use")
product = md(f'{R}/docs/PRODUCT.md', shift=1)
product = re.sub(r'<h2[^>]*>What Martian Map is, and why it works</h2>', '', product)
import json

build = md(f'{R}/docs/BUILD.md', shift=1)
build = re.sub(r'<h2[^>]*>Who builds what, and in what order</h2>', '', build)
rows = re.findall(r'^\| ([A-Z]\d) \| (.*?) \| (P1|P2|P3|PX) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$', Path(f'{R}/docs/BUILD.md').read_text(encoding='utf-8'), re.MULTILINE)
lanes = [('P1', 'Jules · P1 · ML', 'p1'), ('P2', 'Nicolas · P2 · App (lead)', 'p2'), ('P3', 'Galsan · P3 · Data', 'p3'), ('PX', 'Person X · Story (open)', 'px')]
phases = [('M0', 'M0 · Sat 9:00–12:30'), ('M1', 'M1 · 12:30–16:00'), ('M2', 'M2 · 16:00–21:00'), ('Overnight', 'Overnight · to Sun 7:00'), ('Freeze', 'Freeze · Sun 8:00 → submit')]
link = lambda t: re.sub(r'#(\d+)', r'<a href="https://github.com/nicolasrufino/nasaspaceapps/issues/\1" target="_blank" rel="noopener">#\1</a>', t)
B = {i: {'title': t, 'who': {l[0]: l[1] for l in lanes}[w], 'when': dict(phases)[wh], 'what': html.escape(what), 'needs': [n.strip() for n in nd.split(',') if n.strip() not in ('—', '')], 'issue': link(iss) if iss != '—' else ''} for i, t, w, wh, what, nd, iss in rows}
cells = '<div class="bg-h"></div>' + ''.join(f'<div class="bg-h">{h}</div>' for _, h in phases)
for code, label, cls in lanes:
    cells += f'<a class="bg-lane {cls}" href="#overview-roles" title="What this person focuses on">{label}</a>'
    for ph, _ in phases:
        cells += f'<div class="bg-cell {cls}">' + ''.join(f'<div class="blk {cls}" data-id="{i}" tabindex="0" role="button"><span class="bid">{i}</span> {html.escape(t)}<span class="biss">{link(iss) if iss != "—" else ""}</span></div>' for i, t, w, wh, what, nd, iss in rows if w == code and wh == ph) + '</div>'
graph = Path(os.path.join(H, 'buildgraph.html')).read_text(encoding='utf-8').replace('{{CELLS}}', cells).replace('{{BLOCKS}}', json.dumps(B))
overview = md(f'{R}/docs/roles/README.md', shift=2)
overview = re.sub(r'<h3[^>]*>The four roles at a glance</h3>', '', overview)
contracts = md(f'{R}/docs/CONTRACTS.md', shift=1)
contracts = re.sub(r'<h2[^>]*>Contracts \(v1\)</h2>', '', contracts)
agents = md(f'{R}/AGENTS.md', shift=1)
agents = re.sub(r'<h2[^>]*>.*?</h2>', '', agents, count=1, flags=re.DOTALL)
tree = subprocess.run(['bash', '-c', f'cd "{R}" && find . -path ./.git -prune -o -type f -print | grep -v -e "/worlds/synthetic/" -e "docs/team-page/plan.html" -e "docs/deck/" | sed "s#^./##" | sort'], check=False, capture_output=True, text=True).stdout
s = Path(os.path.join(H, 'shell.html')).read_text(encoding='utf-8')
for k, v in {'{{OVERVIEW}}': overview, '{{BUILDGRAPH}}': graph, '{{BUILD}}': build, '{{PRODUCT}}': product, '{{DATA}}': data, '{{CRITIQUE}}': critique, '{{CODEX}}': codex, '{{RESEARCH}}': research, '{{PITCH}}': pitch, '{{SCREENS}}': screens, '{{PLAN}}': plan, '{{ROLES}}': '\n'.join(roles), '{{CONTRACTS}}': contracts, '{{AGENTS}}': agents, '{{TREE}}': html.escape(tree)}.items():
    s = s.replace(k, v)
assert '{{' not in s
Path(H, 'plan.html').write_text(s, encoding='utf-8')
print(len(s))
