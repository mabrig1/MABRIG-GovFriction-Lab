/* GovFriction Lab: deterministic local browser calculation engine. No external requests. */
export const VERSION='bfs-dai-0.1';
export const DEFAULTS={from:'2025-01-01',to:'2025-04-01',snapshot:'2026-11-19',horizonDays:30,minN:10,wFriction:0.70,agency:'DSNY',services:['Graffiti','Missed Collection (All Materials)']};
const aliases={id:['unique_key','unique key','id','request id'],created:['created_date','created date','created'],closed:['closed_date','closed date','closed'],agency:['agency'],service:['complaint_type','problem','complaint type','service'],borough:['borough','location'],status:['status']};
const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
export function autoMap(headers){const m={};for(const [k,as] of Object.entries(aliases))m[k]=headers.find(h=>as.includes(norm(h)))||'';return m}
export function parseCSV(text){
 if(typeof text!=='string')throw Error('Expected CSV text');
 text=text.replace(/^\uFEFF/,'');let row=[],rows=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}
  else if(c==='"'){if(cell!=='')throw Error('Unexpected quote in CSV');quoted=true}
  else if(c===','){row.push(cell);cell=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[]}
  else cell+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 row.push(cell);if(row.some(x=>x!==''))rows.push(row);
 if(rows.length<2)throw Error('CSV must have headers and at least one data row');
 const headers=rows[0].map(x=>x.trim());
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Blank or duplicate CSV column names');
 const data=[];let malformed=0;
 for(const cells of rows.slice(1)){
  if(cells.length!==headers.length){malformed++;continue}
  const v={};headers.forEach((h,j)=>v[h]=cells[j]);data.push(v);
 }
 return {headers,data,malformed};
}
export function timestamp(value){
 const s=String(value??'').trim();if(!s)return null;
 let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
 if(!m){
  const a=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if(!a)return NaN;
  let h=+(a[4]||0);if(a[7])h=h%12+(a[7].toUpperCase()==='PM'?12:0);
  m=[null,a[3],a[1],a[2],String(h),a[5]||'0',a[6]||'0'];
 }
 const [y,mo,d,h,mi,se]=m.slice(1).map(x=>+(x||0));
 const ms=Date.UTC(y,mo-1,d,h,mi,se),t=new Date(ms);
 if(t.getUTCFullYear()!==y||t.getUTCMonth()!==mo-1||t.getUTCDate()!==d||t.getUTCHours()!==h||t.getUTCMinutes()!==mi||t.getUTCSeconds()!==se)return NaN;
 return ms;
}
function wilson(k,n){if(!n)return [null,null];const z=1.959963984540054,p=k/n,z2=z*z,den=1+z2/n,ctr=(p+z2/(2*n))/den,r=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;return [Math.max(0,ctr-r),Math.min(1,ctr+r)]}
function median(values){if(!values.length)return null;values.sort((a,b)=>a-b);const n=values.length;return n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2}
function summarize(cases){
 let late=0,burden=0;const closedDays=[];
 for(const r of cases){
  const d=r.days;late+=d>r.horizon?1:0;burden+=Math.min(d,r.horizon)/r.horizon;
  if(Number.isFinite(d))closedDays.push(d);
 }
 const n=cases.length, nonclosure=late/n,delay=burden/n,ci=wilson(late,n);
 return {n,nonclosure30:nonclosure,delayBurden30:delay,friction:0.5*(nonclosure+delay),lateCount:late,medianClosedDays:median(closedDays),wilsonLow:ci[0],wilsonHigh:ci[1]};
}
export function analyze(rows,map,custom={}){
 const cfg={...DEFAULTS,...custom}, required=['id','created','closed','agency','service','borough'];
 for(const k of required)if(!map[k])throw Error('Map the required column: '+k);
 if(new Set(required.map(k=>map[k])).size!==required.length)throw Error('Each required field must map to a distinct column');
 if(!(cfg.horizonDays>0&&cfg.horizonDays<=365&&Number.isInteger(cfg.horizonDays)&&Number.isInteger(cfg.minN)&&cfg.minN>=1&&cfg.wFriction>=0&&cfg.wFriction<=1))throw Error('Invalid analysis parameters');
 const from=timestamp(cfg.from),to=timestamp(cfg.to),snapshot=timestamp(cfg.snapshot);
 if(!Number.isFinite(from)||!Number.isFinite(to)||!Number.isFinite(snapshot)||from>=to)throw Error('Invalid date window');
 const counts={input:rows.length,scopeExcluded:0,duplicate:0,invalidCreated:0,invalidClosed:0,invalidLocationService:0,immature:0,eligible:0,statusClosedWithoutDate:0};
 const seen=new Set(),good=[],services=new Set(cfg.services||[]);
 const regions=new Set(['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND']);
 for(const r of rows){
  const v=k=>String(r[map[k]]??'').trim();
  const id=v('id'),created=timestamp(v('created')),service=v('service'),borough=v('borough').toUpperCase();
  if(!id||!Number.isFinite(created)){counts.invalidCreated++;continue}
  if(seen.has(id)){counts.duplicate++;continue}seen.add(id);
  if(created<from||created>=to||v('agency').toUpperCase()!==String(cfg.agency).toUpperCase()||!services.has(service)){counts.scopeExcluded++;continue}
  if(!borough||!regions.has(borough)){counts.invalidLocationService++;continue}
  const rawClosed=v('closed'),closed=rawClosed?timestamp(rawClosed):null;
  if((rawClosed&&!Number.isFinite(closed))||(closed!==null&&closed<created)){counts.invalidClosed++;continue}
  if(created>snapshot){counts.scopeExcluded++;continue}
  if(snapshot-created<cfg.horizonDays*86400000){counts.immature++;continue}
  if(v('status').toLowerCase()==='closed'&&!rawClosed)counts.statusClosedWithoutDate++;
  const days=closed===null||closed>snapshot?Infinity:(closed-created)/86400000;
  good.push({service,borough,days,horizon:cfg.horizonDays});
 }
 counts.eligible=good.length;
 const groups=new Map(),byService=new Map();
 for(const g of good){
  const key=g.service+'\u001f'+g.borough;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(g);
  if(!byService.has(g.service))byService.set(g.service,[]);byService.get(g.service).push(g);
 }
 const out=[];
 for(const [key,cases] of groups){
  const [service,borough]=key.split('\u001f'),stat=summarize(cases);
  const peer=(byService.get(service)||[]).filter(x=>x.borough!==borough);
  const peerStat=peer.length?summarize(peer):null,scored=stat.n>=cfg.minN&&peer.length>=cfg.minN;
  const asymmetry=scored?Math.abs(stat.friction-peerStat.friction):null;
  const safe=stat.n<cfg.minN?{...stat,nonclosure30:null,delayBurden30:null,friction:null,lateCount:null,medianClosedDays:null,wilsonLow:null,wilsonHigh:null}:stat;
  out.push({service,borough,...safe,peerN:peer.length,peerFriction:scored?peerStat.friction:null,asymmetry,score:scored?100*(cfg.wFriction*stat.friction+(1-cfg.wFriction)*asymmetry):null,warning:!scored?'Insufficient comparable records':stat.n<30?'Exploratory: n < 30':''});
 }
 out.sort((a,b)=>a.service.localeCompare(b.service)||a.borough.localeCompare(b.borough));
 return {protocol:VERSION,config:cfg,counts,groups:out,notes:['Recorded closure is not verified physical service resolution.','Borough differences are descriptive, not causal.','No composite score confidence intervals are calculated.','Uploaded source rows remain in this browser tab.']};
}
export function exportCSV(rows){
 if(!rows.length)return '';
 const headers=Object.keys(rows[0]);
 const cell=value=>{let s=String(value??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return /[,\r\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 return [headers.map(cell).join(','),...rows.map(r=>headers.map(h=>cell(r[h])).join(',')).map(x=>x)].join('\r\n')+'\r\n';
}
export function compareReports(app,reference,expectedSha,referenceSha){
 if(!expectedSha||!referenceSha)return {ok:false,reason:'Missing source SHA-256. Cannot establish identical input.',rows:[]};
 if(expectedSha.toLowerCase()!==referenceSha.toLowerCase())return {ok:false,reason:'Input SHA-256 mismatch: comparison aborted.',rows:[]};
 if(reference.some(r=>r.source_sha256!==referenceSha))return {ok:false,reason:'Reference rows disagree about source SHA-256.',rows:[]};
 const ref=new Map();for(const r of reference){
  const key=r.service+'\u001f'+r.borough;
  if(ref.has(key))return {ok:false,reason:'Duplicate group in independent results.',rows:[]};
  ref.set(key,r);
 }
 let mismatches=0;const details=[];
 for(const g of app){
  const key=g.service+'\u001f'+g.borough,r=ref.get(key);
  if(!r){mismatches++;details.push({service:g.service,borough:g.borough,result:'MISSING from reference'});continue}
  const matches=g.n===Number(r.n)&&['nonclosure30','delayBurden30','friction','asymmetry','score'].every(k=>{
   const x=g[k],y=r[k]===''||r[k]===undefined?null:Number(r[k]);
   return x===null?y===null:Number.isFinite(y)&&Math.abs(x-y)<=(k==='score'?1e-7:1e-9);
  });
  if(!matches)mismatches++;
  details.push({service:g.service,borough:g.borough,result:matches?'MATCH':'DIFFERENCE'});
  ref.delete(key);
 }
 for(const r of ref.values()){mismatches++;details.push({service:r.service,borough:r.borough,result:'MISSING from app'});}
 return {ok:mismatches===0,mismatches,rows:details,reason:mismatches?'Investigate the mismatched methods or groups.':'Numeric agreement only; not proof of measurement validity.'};
}