import {prepareCohort,analyzePrepared,exportCSV} from './engine.mjs';
const groupKey=(s,b)=>JSON.stringify([s,b]);
const horizonSet=c=>[...new Set([15,30,45,60,90,c.horizonDays])].sort((a,b)=>a-b);
const weightSet=c=>[...new Set([0,.25,.5,.7,.75,1,c.wFriction])].sort((a,b)=>a-b);
export function commonCohortSensitivity(rows,map,primary){
 const horizons=horizonSet(primary.config),weights=weightSet(primary.config),maxH=horizons.at(-1);
 const prepared=prepareCohort(rows,map,{...primary.config,horizonDays:maxH});
 const commonPrimary=analyzePrepared(prepared,primary.config.horizonDays);
 const baseline=new Map(commonPrimary.groups.map(g=>[groupKey(g.service,g.borough),g]));
 const data=[];
 for(const h of horizons){
  const run=analyzePrepared(prepared,h);
  for(const w of weights){
   const scores=run.groups.map(g=>({...g,score:g.score===null?null:100*(w*g.friction+(1-w)*g.asymmetry)}));
   for(const g of scores){
    const old=baseline.get(groupKey(g.service,g.borough));
    data.push({service:g.service,borough:g.borough,horizonDays:h,frictionWeight:w,n:g.n,peerN:g.peerN,eligibleTotal:prepared.counts.eligible,nonclosure:g.nonclosure30,delayBurden:g.delayBurden30,friction:g.friction,peerFriction:g.peerFriction,signedGap:g.peerFriction===null||g.friction===null?null:g.friction-g.peerFriction,score:g.score,rank:g.score===null?null:1+scores.filter(x=>x.service===g.service&&x.score!==null&&x.score>g.score+1e-10).length,deltaVsCommonPrimary:old?.score!=null&&g.score!==null?g.score-old.score:null});
   }
  }
 }
 return {schema:'govfriction-common-cohort-1',source:primary.source,engine:primary.protocol,config:primary.config,horizons,weights,requiredMaturityDays:maxH,ordinaryPrimaryEligible:primary.counts.eligible,commonEligible:prepared.counts.eligible,commonAudit:prepared.counts,notes:['Freeze eligibility at maximum tested horizon after original scope and deduplication rules; shorter-horizon estimands use the same records.','Deltas compare with the primary specification on the restricted common cohort, not the unrestricted primary analysis.','Horizon restriction may select older requests; report both ordinary and common cohort results.'],rows:data};
}
function generator(seed){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
}
function quantile(xs,p){
 const s=[...xs].sort((a,b)=>a-b),i=(s.length-1)*p,l=Math.floor(i),u=Math.ceil(i);
 return s[l]+(s[u]-s[l])*(i-l);
}
const range=xs=>[quantile(xs,.025),quantile(xs,.975)];
export function compositeBootstrap(rows,map,primary,{replications=499,seed=20261125,minDays=8}={}){
 if(!Number.isInteger(replications)||replications<99||replications>1999||!Number.isInteger(seed)||!Number.isInteger(minDays)||minDays<2)throw Error('Invalid bootstrap settings');
 const prepared=prepareCohort(rows,map,primary.config),c=prepared.config;
 if(JSON.stringify(prepared.counts)!==JSON.stringify(primary.counts))throw Error('Primary audit no longer matches input; rerun analysis');
 const point=analyzePrepared(prepared);
 if(JSON.stringify(point.groups)!==JSON.stringify(primary.groups))throw Error('Primary groups no longer match input; rerun analysis');
 const out=[],rand=generator(seed);
 for(const service of [...new Set(point.groups.map(g=>g.service))].sort()){
  const groups=point.groups.filter(g=>g.service===service),boroughs=groups.map(g=>g.borough);
  const days=new Map();
  for(const r of prepared.cases){
   if(r.service!==service)continue;
   if(!days.has(r.creationDay))days.set(r.creationDay,new Map());
   const m=days.get(r.creationDay);
   if(!m.has(r.borough))m.set(r.borough,{n:0,f:0});
   const a=m.get(r.borough);a.n++;a.f+=.5*((r.days>c.horizonDays?1:0)+Math.min(r.days,c.horizonDays)/c.horizonDays);
  }
  const blocks=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);
  const sets=groups.map(g=>{
   const focalDays=blocks.filter(d=>d.has(g.borough)).length;
   const peerDays=blocks.filter(d=>[...d.keys()].some(b=>b!==g.borough)).length;
   return {g,focalDays,peerDays,ok:g.score!==null&&focalDays>=minDays&&peerDays>=minDays,score:[],signed:[],friction:[]};
  });
  if(sets.some(s=>s.ok)){
   for(let rep=0;rep<replications;rep++){
    const sums=new Map(boroughs.map(b=>[b,{n:0,f:0}]));let totalN=0,totalF=0;
    for(let k=0;k<blocks.length;k++){
     const d=blocks[Math.floor(rand()*blocks.length)];
     for(const [b,a] of d){const t=sums.get(b);t.n+=a.n;t.f+=a.f;totalN+=a.n;totalF+=a.f}
    }
    for(const s of sets){
     if(!s.ok)continue;
     const a=sums.get(s.g.borough),pn=totalN-a.n;
     if(a.n<c.minN||pn<c.minN)continue;
     const f=a.f/a.n,p=(totalF-a.f)/pn,gap=f-p;
     s.friction.push(100*f);s.signed.push(100*gap);s.score.push(100*(c.wFriction*f+(1-c.wFriction)*Math.abs(gap)));
    }
   }
  }
  for(const s of sets){
   const valid=s.score.length,pass=s.ok&&valid>=Math.ceil(.95*replications);
   out.push({service,borough:s.g.borough,n:s.g.n,peerN:s.g.peerN,serviceDays:blocks.length,focalDays:s.focalDays,peerDays:s.peerDays,validReplications:valid,pointScore:s.g.score,pointFriction:s.g.friction===null?null:100*s.g.friction,pointSignedGap:s.g.peerFriction===null||s.g.friction===null?null:100*(s.g.friction-s.g.peerFriction),scoreLow:pass?range(s.score)[0]:null,scoreHigh:pass?range(s.score)[1]:null,frictionLow:pass?range(s.friction)[0]:null,frictionHigh:pass?range(s.friction)[1]:null,signedGapLow:pass?range(s.signed)[0]:null,signedGapHigh:pass?range(s.signed)[1]:null,status:pass?'Exploratory percentile interval':!s.ok?'Withheld: unscorable group or insufficient distinct creation days':'Withheld: fewer than 95% valid resamples'});
  }
 }
 return {schema:'govfriction-composite-bootstrap-1',source:primary.source,engine:primary.protocol,config:c,method:{unit:'observed creation day within service, paired across boroughs',replications,seed,minDays,validFraction:.95,interval:'2.5%–97.5% linear-interpolated percentiles',scale:'index points 0–100; signed gap -100 to 100'},notes:['Resamples observed days with replacement within each service, jointly for focal and peer counts. Recomputes pooled peer friction and absolute asymmetry for every draw.','Exploratory repeated-day variability, not survey/design-based uncertainty for a complete administrative census; no correction for serial dependence, missing reports, recording errors, selection or structural bias.','Minimum days and valid-replication rules are provisional. No p-values, causal claims or external validity. Independent replication required.'],rows:out};
}
export function initUncertaintyLab({getState,download}){
 const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n};
 const section=el('section');section.id='uncertainty-lab';section.style.marginTop='2rem';
 section.append(el('h3','Scientific robustness and uncertainty'),el('p','Common-cohort sensitivity separates follow-up eligibility changes from specification changes. Day-cluster bootstrap ranges are exploratory, not proof of validity.'));
 const actions=el('div');actions.className='actions';section.append(actions);
 const status=el('p','Run an audited analysis first.'),wrap=el('div');wrap.className='tablewrap';section.append(status,wrap);
 let common=null,boot=null;
 const btn=(title,fn)=>{const b=el('button',title);b.type='button';b.className='secondary';b.addEventListener('click',()=>{try{fn()}catch(e){status.textContent=e.message}});actions.append(b)};
 const current=()=>{const s=getState();if(!s.report||!s.dataset||!s.sha||s.sha!==s.report.source?.sha256)throw Error('Run an audited analysis with the original source hash first');return s};
 function show(headers,rows){
  wrap.replaceChildren();const table=el('table'),thead=el('thead'),head=el('tr');headers.forEach(h=>head.append(el('th',h)));thead.append(head);table.append(thead);const body=el('tbody');
  for(const r of rows){const tr=el('tr');r.forEach(v=>tr.append(el('td',v==null?'—':typeof v==='number'?Number(v.toFixed(3)).toString():v)));body.append(tr)}table.append(body);wrap.append(table);
 }
 btn('Run common-cohort sensitivity',()=>{const s=current();common=null;common=commonCohortSensitivity(s.dataset.data,s.report.mapping,s.report);status.textContent=(s.report.source.synthetic?'SYNTHETIC — ':'')+'Common eligible: '+common.commonEligible+' / ordinary primary '+common.ordinaryPrimaryEligible+'; maturity '+common.requiredMaturityDays+' days. Showing first 50 rows.';show(['Service','Borough','Horizon','Weight','n','Score','Rank','Delta'],common.rows.slice(0,50).map(r=>[r.service,r.borough,r.horizonDays,r.frictionWeight,r.n,r.score,r.rank,r.deltaVsCommonPrimary]))});
 btn('Run composite day bootstrap',()=>{const s=current();boot=null;boot=compositeBootstrap(s.dataset.data,s.report.mapping,s.report);status.textContent=(s.report.source.synthetic?'SYNTHETIC — ':'')+'499 paired creation-day resamples; exploratory intervals. '+boot.notes[1];show(['Service','Borough','Days','Valid draws','Score','Lower','Upper','Signed gap','Gap lower','Gap upper','Status'],boot.rows.map(r=>[r.service,r.borough,r.focalDays,r.validReplications,r.pointScore,r.scoreLow,r.scoreHigh,r.pointSignedGap,r.signedGapLow,r.signedGapHigh,r.status]))});
 const save=(name,result)=>{current();if(!result)throw Error('Run the corresponding analysis first');download(JSON.stringify(result,null,2),name+'.json','application/json')};
 btn('Common-cohort JSON',()=>save('govfriction-common-cohort',common));
 btn('Bootstrap JSON',()=>save('govfriction-composite-bootstrap',boot));
 btn('Bootstrap CSV',()=>{current();if(!boot)throw Error('Run bootstrap first');download(exportCSV(boot.rows.map(r=>({...r,source_sha256:boot.source.sha256,synthetic:boot.source.synthetic}))),'govfriction-composite-bootstrap.csv','text/csv')});
 document.getElementById('results').append(section);
 return {reset:()=>{common=null;boot=null;wrap.replaceChildren();status.textContent='Run a robustness experiment on the current audited report.'}};
}
