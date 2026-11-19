import {autoMap,parseCSV,analyze,exportCSV,compareReports,DEFAULTS} from './engine.mjs';
const $=id=>document.getElementById(id);
let dataset=null,mapping=null,report=null,sha=null,filename='';
const required=['id','created','closed','agency','service','borough'];
const titles={id:'Request ID',created:'Creation timestamp',closed:'Closure timestamp',agency:'Agency',service:'Service / problem',borough:'Borough',status:'Recorded status (optional)'};
const int=n=>Number.isFinite(n)?n.toLocaleString('en-US'):'—';
const pct=n=>n===null||n===undefined?'—':(100*n).toFixed(1)+'%';
const dec=n=>n===null||n===undefined||!Number.isFinite(n)?'—':n.toFixed(2);
const make=(tag,cls='',value='')=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=String(value);return node};
const syntheticLabel='SYNTHETIC demonstration — not NYC observations.csv';
async function hashText(text){
 if(!globalThis.crypto?.subtle)return null;
 const bytes=new TextEncoder().encode(text),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function loadCSV(text,name){
 const parsed=parseCSV(text);
 dataset=parsed;mapping=autoMap(parsed.headers);filename=name;sha=await hashText(text);report=null;
 $('results').hidden=true;$('analyze').disabled=false;$('mapping').hidden=false;
 $('filemeta').textContent=name+' · '+int(parsed.data.length)+' parsed rows · '+int(parsed.malformed)+' malformed CSV rows · SHA-256: '+(sha||'Unavailable. Serve the page via HTTPS or localhost.');
 $('compareout').textContent='Run analysis first, then select the independent Kaggle results file.';
 const target=$('mapgrid');target.replaceChildren();
 for(const key of [...required,'status']){
  const label=make('label','',titles[key]),select=make('select');
  for(const heading of ['',...parsed.headers]){
   const opt=make('option','',heading||'Not mapped');opt.value=heading;
   if(mapping[key]===heading)opt.selected=true;
   select.append(opt);
  }
  select.setAttribute('aria-label',titles[key]);
  select.addEventListener('change',()=>{mapping[key]=select.value});
  label.append(select);target.append(label);
 }
}
$('file').addEventListener('change',async event=>{
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{
  if(file.size>15*1024*1024)throw Error('CSV exceeds the 15 MB pilot limit.');
  await loadCSV(await file.text(),file.name);
 }catch(error){alert('Could not load CSV: '+error.message)}
});
$('weight').addEventListener('input',()=>{$('weightOut').textContent=$('weight').value+'%'});
function syntheticCSV(){
 const rows=['unique_key,created_date,closed_date,agency,complaint_type,borough,status'];
 let id=0;
 const regions=['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND'];
 const baselines={BRONX:5,BROOKLYN:8,MANHATTAN:2,QUEENS:15,'STATEN ISLAND':24};
 for(const service of DEFAULTS.services)for(const region of regions)for(let k=0;k<24;k++){
  id++;
  const created=new Date(Date.UTC(2025,0,2+(k*3+id)%80,id%12));
  const days=Math.max(0,baselines[region]+(service==='Graffiti'?6:0)+(k%7)*3-7);
  const closed=(k+id)%13===0?'':new Date(created.getTime()+(days*24+k%6)*3600000).toISOString().slice(0,19);
  const values=['SYN-'+String(id).padStart(5,'0'),created.toISOString().slice(0,19),closed,'DSNY',service,region,closed?'Closed':'Open'];
  rows.push(values.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','));
 }
 return rows.join('\n');
}
$('demo').addEventListener('click',async()=>{try{await loadCSV(syntheticCSV(),syntheticLabel)}catch(e){alert(e.message)}});
$('analyze').addEventListener('click',()=>{
 if(!dataset)return;
 try{
  const config={from:$('from').value,to:$('to').value,snapshot:$('snapshot').value,horizonDays:Number($('horizon').value),minN:Number($('minN').value),wFriction:Number($('weight').value)/100};
  report=analyze(dataset.data,mapping,config);
  report.source={filename,sha256:sha,parsedRows:dataset.data.length,malformedCSVRows:dataset.malformed,synthetic:filename.startsWith('SYNTHETIC')};
  showReport();$('results').hidden=false;$('results').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){alert('Analysis stopped: '+error.message)}
});
function showReport(){
 const counts=report.counts,groups=report.groups,scored=groups.filter(g=>g.score!==null);
 $('resultstate').className='sourceflag'+(report.source.synthetic?'':' real');
 $('resultstate').textContent=report.source.synthetic?'SYNTHETIC TRAINING DATA — these are fabricated example records.':'USER-UPLOADED DATA — verify source, coverage and representativeness before making empirical claims.';
 const kpis=$('kpis');kpis.replaceChildren();
 for(const [value,label] of [[int(counts.eligible),'Eligible requests'],[int(scored.length),'Scorable service–borough groups'],[scored.length?dec(scored.reduce((a,g)=>a+g.score,0)/scored.length):'—','Mean score across groups (unweighted)']]){
  const card=make('div','kpi');card.append(make('strong','',value),make('span','',label));kpis.append(card);
 }
 const audit=$('audit');audit.replaceChildren();
 for(const [field,n] of Object.entries(counts)){
  const item=make('div');item.append(make('b','',int(n)),make('span','',field.replace(/([A-Z])/g,' $1')));audit.append(item);
 }
 const filter=$('filterService'),previous=filter.value;
 filter.replaceChildren();const all=make('option','','All services');all.value='all';filter.append(all);
 for(const service of [...new Set(groups.map(g=>g.service))].sort()){
  const o=make('option','',service);o.value=service;filter.append(o);
 }
 filter.value=[...filter.options].some(o=>o.value===previous)?previous:'all';
 redrawGroupViews();
 $('compareout').textContent='Ready for independent Kaggle comparison. Both source SHA-256 checksums must be identical.';
}
function redrawGroupViews(){
 if(!report)return;
 const selected=$('filterService').value;
 const groups=report.groups.filter(g=>selected==='all'||g.service===selected);
 const table=$('tablebody');table.replaceChildren();
 for(const g of groups){
  const tr=make('tr');
  for(const val of [g.service+' / '+g.borough,int(g.n),pct(g.nonclosure30),pct(g.delayBurden30),pct(g.asymmetry),dec(g.score)])tr.append(make('td','',val));
  tr.title=g.warning||('Wilson 95% interval for nonclosure: '+pct(g.wilsonLow)+'–'+pct(g.wilsonHigh));
  table.append(tr);
 }
 const chart=$('bars');chart.replaceChildren();
 const scored=groups.filter(g=>g.score!==null).sort((a,b)=>b.score-a.score);
 if(!scored.length){chart.append(make('p','sub','No comparable groups meet the current minimum size.'));return}
 for(const g of scored.slice(0,15)){
  const row=make('div','baritem');
  const label=make('div','',g.service.replace('Missed Collection (All Materials)','Missed collection')+' · '+g.borough);
  const track=make('div','barline'),bar=make('div','barfill');
  bar.style.width=Math.max(0,Math.min(g.score,100))+'%';bar.setAttribute('aria-label','BFS-DAI '+dec(g.score));
  track.append(bar);row.append(label,track,make('strong','',dec(g.score)));chart.append(row);
 }
}
$('filterService').addEventListener('change',redrawGroupViews);
function download(data,name,mime){
 const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$('reportjson').addEventListener('click',()=>{
 if(report)download(JSON.stringify(report,null,2),'govfriction-research-record.json','application/json');
});
$('resultcsv').addEventListener('click',()=>{
 if(!report)return;
 const rows=report.groups.map(g=>({...g,source_sha256:sha||'',protocol:report.protocol}));
 download(exportCSV(rows),'govfriction-app-results.csv','text/csv;charset=utf-8');
});
$('comparefile').addEventListener('change',async event=>{
 if(!report){$('compareout').textContent='Run analysis before comparing.';return}
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{
  if(file.size>15*1024*1024)throw Error('Comparison file exceeds 15 MB.');
  const ref=parseCSV(await file.text()).data;
  const comparison=compareReports(report.groups,ref,sha,ref[0]?.source_sha256);
  $('compareout').textContent=(comparison.ok?'PASS':'REVIEW NEEDED')+' — '+comparison.reason+
   (comparison.rows.length?'\n'+comparison.rows.map(g=>g.service+' / '+g.borough+': '+g.result).join('\n'):'');
 }catch(error){$('compareout').textContent='Comparison stopped: '+error.message}
});