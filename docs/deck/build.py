"""Build the reviewed slide sources into a portable, offline HTML presentation."""

import argparse
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def build():
    deck = json.loads((ROOT / "deck.json").read_text(encoding="utf-8"))
    slides = []
    for key in deck["order"]:
        slide = (ROOT / "slides" / f"{key}.html").read_text(encoding="utf-8")
        slides.append(slide.replace(" hidden", ' data-backup="true"'))
    content = "\n".join(slides)
    picture = ROOT / "assets" / "scout-three-flights.png"
    content = content.replace(
        "assets/scout-three-flights.png",
        "data:image/png;base64," + base64.b64encode(picture.read_bytes()).decode(),
    )
    css = (ROOT / "deck.css").read_text(encoding="utf-8")
    return """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mission VESTA — Vesta Scout</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@400..800&family=Michroma&display=swap"><style>
*{box-sizing:border-box;margin:0}body{background:#252525;overflow:hidden}
""" + css + """
#stage{position:absolute;transform-origin:top left;width:1920px;height:1080px}
section{position:relative;width:1920px;height:1080px;overflow:hidden;display:none}
section.current{display:flex}aside{display:none}
nav{position:fixed;bottom:8px;left:8px;display:flex;gap:8px;align-items:center;
font:14px Arial;color:white;background:#111e;padding:8px;border-radius:8px}
button{font:inherit;padding:6px 10px;cursor:pointer}
#notes{position:fixed;bottom:60px;left:16px;right:16px;max-height:35vh;overflow:auto;
background:#fff;color:#222;padding:20px;font:18px/1.5 Arial;z-index:4}
body.contact{overflow:auto}body.contact #stage{position:static;transform:none!important;
width:auto;height:auto;display:grid;grid-template-columns:repeat(2,576px);gap:20px;padding:20px}
body.contact .sheet{width:576px;height:324px;position:relative;overflow:hidden}
body.contact section{display:flex;transform:scale(.3);transform-origin:top left}
body.contact nav{display:none}
@media print{@page{size:16in 9in;margin:0}body{overflow:visible;background:white}
#stage{position:static;transform:none!important}section{display:flex;break-after:page}
nav,#notes{display:none!important}}
</style><div id="stage">""" + content + """</div>
<nav aria-label="Presentation controls"><button id="prevSlide">Previous</button>
<span id="count"></span><button id="nextSlide">Next</button>
<button id="toggle" aria-expanded="false">Speaker notes (N)</button>
<span>← → / Space · last two slides are backups</span></nav>
<div id="notes" hidden></div>
<script>
const slides=[...document.querySelectorAll('section')],stage=document.querySelector('#stage');let i=0;
function resize(){const s=Math.min(innerWidth/1920,(innerHeight-55)/1080);
stage.style.transform=`scale(${s})`;stage.style.left=`${(innerWidth-1920*s)/2}px`;stage.style.top='0'}
function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,k)=>s.classList.toggle('current',k===i));
document.querySelector('#count').textContent=`${i+1} / ${slides.length}${slides[i].dataset.backup?' · Backup':''}`;
document.querySelector('#notes').textContent=slides[i].querySelector('aside')?.textContent||'';
document.querySelector('#prevSlide').disabled=i===0;document.querySelector('#nextSlide').disabled=i===slides.length-1}
function notes(){const box=document.querySelector('#notes');box.hidden=!box.hidden;
document.querySelector('#toggle').setAttribute('aria-expanded',String(!box.hidden))}
document.querySelector('#prevSlide').onclick=()=>show(i-1);document.querySelector('#nextSlide').onclick=()=>show(i+1);
document.querySelector('#toggle').onclick=notes;addEventListener('resize',resize);
addEventListener('keydown',e=>{if(['ArrowRight',' ','PageDown'].includes(e.key)){e.preventDefault();show(i+1)}
if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(i-1)}if(e.key.toLowerCase()==='n')notes()});
if(new URLSearchParams(location.search).has('contact')){document.body.classList.add('contact');
slides.forEach(s=>{const frame=document.createElement('div');frame.className='sheet';stage.insertBefore(frame,s);frame.append(s)})}
show(0);resize();
</script></html>"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(build(), encoding="utf-8")
    print(f"Wrote {args.out} (14 slides, screenshot embedded; no network needed)")
