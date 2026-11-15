const byId = id => document.getElementById(id);
const names = {soil:'Sol fin',bedrock:'Roche en place',sand:'Sable',big_rock:'Grosse roche',unknown:'Incertain / mixte'};
const assisted = pack.review_mode === 'assisted';
const storageKey = `ingenuity-review-v2:${pack.manifest_sha256}:${pack.suggestion_model_sha256 || 'blind'}`;
let current = 0, labels = {}, drafts = {}, confirmedAt = {}, imageReady = false;
const ids = new Set(pack.records.map(r => r.id));
function validateImport(result) {
  if (result.manifest_sha256 !== pack.manifest_sha256 || !result.reviewer?.trim() || !Array.isArray(result.annotations) || result.annotations.length !== ids.size) throw Error('Cet export ne correspond pas à ce lot.');
  if (!assisted && (result.review_mode === 'assisted' || result.independent_human_test === false || result.suggestion_model_sha256 || result.annotations.some(r=>r.suggestion!=null))) throw Error('Une revue assistée ne peut pas devenir une revue à l’aveugle.');
  const seen = new Set();
  for (const row of result.annotations) {
    if (!ids.has(row.id) || seen.has(row.id) || (row.label !== null && !Object.hasOwn(names,row.label))) throw Error('Annotations manquantes ou invalides.');
    seen.add(row.id);
  }
}
function exportValue() {
  return {schema_version:2,manifest_sha256:pack.manifest_sha256,review_mode:pack.review_mode,
    independent_human_test:!assisted,suggestion_model_sha256:pack.suggestion_model_sha256,
    reviewer:byId('reviewer').value.trim(),exported_at:new Date().toISOString(),
    annotations:pack.records.map(r=>({id:r.id,label:labels[r.id]||null,
      confirmed_at:confirmedAt[r.id]||null,suggestion:assisted?r.suggestion:null}))};
}
function persist() {
  try {localStorage.setItem(storageKey,JSON.stringify({review:exportValue(),current}));byId('storage-note').textContent='Progression enregistrée dans ce navigateur. Exportez aussi le JSON pour conserver une copie et me la transmettre.';}
  catch {byId('storage-note').textContent='Sauvegarde du navigateur indisponible : exportez régulièrement le JSON avant de fermer.';}
}
function restore(result) {
  validateImport(result);
  labels={};drafts={};confirmedAt={};
  for(const row of result.annotations){if(row.label){labels[row.id]=row.label;confirmedAt[row.id]=row.confirmed_at||null;}}
  byId('reviewer').value=result.reviewer;
  current=Math.max(0,pack.records.findIndex(r=>!labels[r.id]));
}
function refreshButton() {byId('confirm').disabled=!imageReady || !byId('choice').value;}
function render() {
  const r=pack.records[current], total=Object.keys(labels).length;
  byId('identity').textContent=`Image ${r.id}`;
  byId('progress').textContent=`${current+1} / ${pack.records.length} — ${total} confirmées`;
  byId('bar').max=pack.records.length;byId('bar').value=total;
  byId('suggestion').hidden=!assisted;
  byId('suggestion').textContent=assisted?`Suggestion du modèle : ${names[r.suggestion]}. À vérifier sur l’image.`:'';
  byId('choice').value=drafts[r.id] ?? labels[r.id] ?? (assisted?r.suggestion:'');
  byId('confirmed').textContent=labels[r.id]?`Votre validation : ${names[labels[r.id]]}`:'À confirmer par vous';
  byId('previous').disabled=current===0;byId('next').disabled=current===pack.records.length-1;
  byId('unconfirm').disabled=!labels[r.id];
  byId('confirm').textContent=current===pack.records.length-1?'Confirmer cette image':'Confirmer et suivant';
  const image=byId('patch');imageReady=false;refreshButton();byId('image-error').hidden=true;
  image.onload=()=>{imageReady=image.naturalWidth===128 && image.naturalHeight===128;refreshButton();};
  image.onerror=()=>{imageReady=false;refreshButton();byId('image-error').hidden=false;byId('image-error').textContent='L’image ne peut pas être affichée. Ne validez pas ce carré.';};
  image.src=r.image;
  if(image.complete && image.naturalWidth===128){imageReady=true;refreshButton();}
}
byId('intro').textContent=assisted?'La catégorie est proposée automatiquement. Vérifiez l’image, corrigez si besoin, puis confirmez.':'Examinez l’image, choisissez une catégorie, puis confirmez.';
byId('mode-note').textContent=assisted?'Revue assistée : une suggestion ne devient jamais une annotation sans votre confirmation. Cet export sera identifié comme assisté, et non comme un test à l’aveugle.':'Revue à l’aveugle : aucune prédiction du modèle n’est affichée.';
byId('choice').onchange=()=>{const id=pack.records[current].id;drafts[id]=byId('choice').value;delete labels[id];delete confirmedAt[id];render();persist();};
byId('reviewer').oninput=persist;
byId('confirm').onclick=()=>{
  if(!imageReady || !byId('choice').value)return;
  if(!byId('reviewer').value.trim()){byId('message').textContent='Indiquez votre nom avant de confirmer.';byId('reviewer').focus();return;}
  const id=pack.records[current].id;labels[id]=byId('choice').value;confirmedAt[id]=new Date().toISOString();delete drafts[id];
  byId('message').textContent=`${id} confirmé : ${names[labels[id]]}.`;
  if(current<pack.records.length-1)current++;render();persist();
};
byId('previous').onclick=()=>{if(current>0)current--;render();persist();};
byId('next').onclick=()=>{if(current<pack.records.length-1)current++;render();persist();};
byId('unconfirm').onclick=()=>{const id=pack.records[current].id;delete labels[id];delete confirmedAt[id];render();persist();};
byId('save').onclick=()=>{
  const result=exportValue();if(!result.reviewer){byId('message').textContent='Indiquez votre nom avant l’export.';return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=assisted?'ingenuity-review-assisted.json':'ingenuity-review-blind.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  byId('message').textContent='Export effectué. Seules vos confirmations sont enregistrées comme labels.';
};
byId('resume').onchange=async e=>{try{restore(JSON.parse(await e.target.files[0].text()));render();persist();byId('message').textContent='Validations restaurées.';}catch(error){byId('message').textContent=error.message;}};
try {const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.review?.reviewer){restore(saved.review);if(Number.isInteger(saved.current)&&saved.current>=0&&saved.current<pack.records.length)current=saved.current;}}
catch {byId('message').textContent='La sauvegarde locale n’a pas été chargée. Vous pouvez importer un export JSON.';}
render();persist();
