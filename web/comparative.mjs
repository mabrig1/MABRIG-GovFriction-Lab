import {exportCSV} from './engine.mjs';
const fields=['nonclosure','delayBurden','friction','bfsDai'];
const number=x=>typeof x==='number'&&Number.isFinite(x);
const ranks=values=>values.map(v=>1+values.filter(x=>x>v+1e-10).length+(values.filter(x=>Math.abs(x-v)<=1e-10).length-1)/2);
function pearson(a,b){
 if(a.length<3)return null;
 const avg=x=>x.reduce((s,v)=>s+v,0)/x.length;
 const x=avg(a),y=avg(b);
 const u=a.map(v=>v-x),v=b.map(t=>t-y);
 const ss=u.reduce((s,t,i)=>s+t*v[i],0),den=Math.sqrt(u.reduce((s,t)=>s+t*t,0)*v.reduce((s,t)=>s+t*t,0));
 return den?ss/den:null;
}
export function compareIndicators(report){
 const services=[...new Set(report.groups.map(g=>g.service))].sort(),rows=[],summaries=[];
 for(const service of services){
  const all=report.groups.filter(g=>g.service===service);
  const valid=all.filter(g=>[g.nonclosure30,g.delayBurden30,g.friction,g.score,g.peerFriction].every(number));
  const data=valid.map(g=>({service,borough:g.borough,n:g.n,peerN:g.peerN,nonclosure:g.nonclosure30*100,delayBurden:g.delayBurden30*100,friction:g.friction*100,bfsDai:g.score,signedPeerGap:(g.friction-g.peerFriction)*100,absolutePeerGap:g.asymmetry*100}));
  const vectors=Object.fromEntries(fields.map(f=>[f,ranks(data.map(r=>r[f]))]));
  data.forEach((r,i)=>{
   for(const f of fields)r[f+'Rank']=vectors[f][i];
   r.rankShiftVsFriction=r.bfsDaiRank-r.frictionRank;
   rows.push(r);
  });
  for(const g of all.filter(g=>!valid.includes(g)))rows.push({service,borough:g.borough,n:g.n,peerN:g.peerN,nonclosure:null,delayBurden:null,friction:null,bfsDai:null,signedPeerGap:null,absolutePeerGap:null,nonclosureRank:null,delayBurdenRank:null,frictionRank:null,bfsDaiRank:null,rankShiftVsFriction:null});
  summaries.push({service,groups:all.length,comparable:valid.length,suppressed:all.length-valid.length,nonclosureDelaySpearman:pearson(vectors.nonclosure,vectors.delayBurden),indexFrictionSpearman:pearson(vectors.bfsDai,vectors.friction),indexNonclosureSpearman:pearson(vectors.bfsDai,vectors.nonclosure),indexDelaySpearman:pearson(vectors.bfsDai,vectors.delayBurden),changedRanks:data.filter(r=>Math.abs(r.rankShiftVsFriction)>1e-10).length});
 }
 return {schema:'govfriction-comparative-1',engine:report.protocol,source:report.source,config:report.config,rows,summaries,notes:['All rankings use the same scoreable groups within each service, descending with average tied ranks.','Rank correlations are descriptive; no p-values or claims of improvement. Undefined correlations and fewer than three comparable groups are null.','Scores are 0–100; signed gaps are index points on the friction scale.','Nonclosure by the analytical horizon is not a verified contractual SLA breach.','Suppressed groups are withheld from comparative ranks, even if individual components were available.','Recorded closure is not physical service resolution. Reported requests do not measure all underlying need.']};
}
export function comparisonSvg(result,service){
 const rows=result.rows.filter(r=>r.service===service&&number(r.bfsDai));
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const h=160+rows.length*66,colors=['#0072B2','#D55E00','#009E73','#76549A'];
 const a=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 '+h+'" width="900" height="'+h+'" role="img">','<title>Within-service indicator comparison</title>','<rect width="100%" height="100%" fill="white"/>','<g font-family="Arial,sans-serif" fill="#20252c">','<text x="20" y="27" font-size="20" font-weight="bold">Within-service indicator comparison</text>','<text x="20" y="49" font-size="14">'+esc(service)+'</text>','<text x="20" y="70" font-size="13">'+(result.source?.synthetic?'SYNTHETIC — not empirical evidence':'Uploaded data — verify provenance')+' | '+esc(result.config?.horizonDays)+'-day horizon</text>'];
 for(let t=0;t<=100;t+=20){const x=195+t*6.5;a.push('<line x1="'+x+'" x2="'+x+'" y1="90" y2="'+(h-55)+'" stroke="#ddd"/>','<text x="'+x+'" y="'+(h-38)+'" text-anchor="middle" font-size="12">'+t+'</text>')}
 rows.forEach((r,i)=>{
  const y=95+i*66;a.push('<text x="20" y="'+(y+25)+'" font-size="13">'+esc(r.borough)+'</text>');
  fields.forEach((f,j)=>{a.push('<rect x="195" y="'+(y+j*12)+'" width="'+(Math.max(0,Math.min(100,r[f]))*6.5)+'" height="9" fill="'+colors[j]+'"/>')});
 });
 if(!rows.length)a.push('<text x="20" y="110">No comparable groups meet the threshold.</text>');
 ['Nonclosure','Delay burden','Friction','BFS-DAI'].forEach((f,i)=>a.push('<rect x="'+(20+i*210)+'" y="'+(h-22)+'" width="12" height="12" fill="'+colors[i]+'"/><text x="'+(38+i*210)+'" y="'+(h-12)+'" font-size="12">'+f+'</text>'));
 a.push('</g></svg>');return a.join('');
}
export function initComparativeObservatory({getReport,download}){
 const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n};
 const section=el('section');section.id='comparative-observatory';section.style.marginTop='2rem';
 section.append(el('h3','Civic comparative observatory'),el('p','Compare conventional processing indicators with BFS-DAI on identical, scoreable service–borough groups. Changes in rank are descriptive, not proof of better validity.'));
 const label=el('label','Service'),select=el('select');label.append(select);section.append(label);
 const message=el('p'),tableWrap=el('div'),summaryWrap=el('div');tableWrap.className='tablewrap';summaryWrap.className='tablewrap';section.append(message,summaryWrap,tableWrap);
 const chart=el('div');chart.className='vizcanvas';section.append(chart);
 const actions=el('div');actions.className='actions';section.append(actions);
 let result=null;
 function table(parent,headers,rows){
  parent.replaceChildren();const t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);
  const body=el('tbody');for(const row of rows){const tr=el('tr');row.forEach(x=>tr.append(el('td',x==null?'—':typeof x==='number'?Number(x.toFixed(3)).toString():String(x))));body.append(tr)}t.append(body);parent.append(t);
 }
 function redraw(){
  if(!result)return;const s=select.value;
  table(summaryWrap,['Service','Comparable groups','Suppressed','N–D rank rho','Index–friction rank rho','Index–nonclosure rank rho','Index–delay rank rho','Changed ranks'],result.summaries.filter(r=>r.service===s).map(r=>[r.service,r.comparable,r.suppressed,r.nonclosureDelaySpearman,r.indexFrictionSpearman,r.indexNonclosureSpearman,r.indexDelaySpearman,r.changedRanks]));
  table(tableWrap,['Borough','n','Nonclosure %','Delay burden %','Friction /100','Signed peer gap','BFS-DAI /100','Friction rank','Index rank','Rank shift'],result.rows.filter(r=>r.service===s).map(r=>[r.borough,r.n,r.nonclosure,r.delayBurden,r.friction,r.signedPeerGap,r.bfsDai,r.frictionRank,r.bfsDaiRank,r.rankShiftVsFriction]));
  chart.replaceChildren();if(!s)return;const image=el('img');image.alt='Within-service comparison of four processing indicators';image.style.maxWidth='100%';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(comparisonSvg(result,s));chart.append(image);
 }
 select.addEventListener('change',redraw);
 const btn=(name,fn)=>{const b=el('button',name);b.type='button';b.className='secondary';b.addEventListener('click',()=>{if(result&&getReport())fn()});actions.append(b)};
 btn('Comparative evidence JSON',()=>download(JSON.stringify(result,null,2),'govfriction-comparative.json','application/json'));
 btn('Indicator comparison CSV',()=>download(exportCSV(result.rows.map(r=>({...r,source_sha256:result.source?.sha256,synthetic:!!result.source?.synthetic}))),'govfriction-comparative.csv','text/csv'));
 btn('Publication figure SVG',()=>download(comparisonSvg(result,select.value),'govfriction-comparative.svg','image/svg+xml'));
 const note=el('p','Adapted from the civic analytics approach of Civic-Operations-Analytics (MIT). Here the horizon and eligibility rules follow BFS-DAI, not the upstream SLA definitions.');section.append(note);
 document.getElementById('results').append(section);
 return {render:()=>{const report=getReport();if(!report)return;result=compareIndicators(report);select.replaceChildren();for(const r of result.summaries){const opt=el('option',r.service);opt.value=r.service;select.append(opt)}message.textContent=(result.source?.synthetic?'SYNTHETIC — not empirical evidence. ':'User-uploaded data — verify provenance. ')+result.notes.join(' ');redraw()}};
}
