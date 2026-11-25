import {analyze,DEFAULTS,VERSION,exportCSV} from './engine.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>JSON.stringify(x, Object.keys(x).sort());
const configKeys=['from','to','snapshot','horizonDays','minN','wFriction','agency','services'];
const configOf=c=>Object.fromEntries(configKeys.map(k=>[k,c[k]??DEFAULTS[k]]));
const configEqual=(a,b)=>JSON.stringify(configOf(a))===JSON.stringify(configOf(b));
const mappingEqual=(a,b)=>canonical(a)===canonical(b);
const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
export const FORMULA='N = mean(t > H); D = mean(min(t,H)/H); F = 0.5*N + 0.5*D; P = pooled other-region friction within same service; A = abs(F-P); BFS-DAI = 100*(wFriction*F+(1-wFriction)*A).';
export const LIMITATIONS=['Recorded closure is not verified physical resolution.','Administrative records represent reported requests, not all underlying service needs.','Geographical differences are descriptive, not causal.','Weights and index validity remain exploratory; composite uncertainty is not estimated.','Absolute asymmetry is directionless; a signed friction difference is separately reported.','Source timestamps are interpreted as naive wall-clock times.','User-uploaded source provenance requires independent verification.'];
export function freezeProtocol(state,question,hypotheses,sourceURL,now=new Date().toISOString()){
 if(!state.dataset||!validHash(state.sha))throw Error('Load a frozen dataset with a SHA-256 first.');
 if(!question.trim())throw Error('Enter the primary research question.');
 // Validate parameters and column mappings before recording a local protocol.
 analyze([],state.mapping,state.config);
 return clone({schema:'govfriction-protocol-1',engine:VERSION,createdAt:now,question:question.trim(),hypotheses:hypotheses.trim(),sourceURL:sourceURL.trim(),sourceSha256:state.sha,synthetic:state.synthetic,config:configOf(state.config),mapping:state.mapping,formula:FORMULA,plannedHorizons:[15,30,45,60,90],plannedFrictionWeights:[0,.25,.5,.7,.75,1],status:'Local protocol record only; not an external preregistration or proof of prior analysis.'});
}
export function methodsRecord(report,frozen){
 const source=report.source??{};
 const match=!!frozen&&validHash(source.sha256)&&frozen.sourceSha256===source.sha256&&frozen.engine===report.protocol&&configEqual(frozen.config,report.config)&&mappingEqual(frozen.mapping,report.mapping);
 return clone({schema:'govfriction-methods-1',engine:report.protocol,formula:FORMULA,source,config:configOf(report.config),mapping:report.mapping,counts:report.counts,eligibility:'Keep first duplicate ID; require valid ID and creation timestamp; restrict to selected dates, agency, services and NYC boroughs; exclude invalid closure dates and records without full horizon follow-up. Missing or post-snapshot closure means no documented closure. Closure exactly at H counts as closed.',protocolStatus:match?'Matches local frozen protocol':'Exploratory: no matching frozen protocol',frozenProtocol:match?frozen:null,uncertainty:'Wilson 95% intervals apply to nonclosure only; independence approximation.',limitations:[...LIMITATIONS],citation:'MABRIG Technologies. GovFriction Lab (engine '+report.protocol+'). https://github.com/mabrig1/MABRIG-GovFriction-Lab. No DOI assigned in this release.'});
}
export function sensitivity(rows,map,primary){
 const c=configOf(primary.config),horizons=[...new Set([15,30,45,60,90,c.horizonDays])].sort((a,b)=>a-b),weights=[...new Set([0,.25,.5,.7,.75,1,c.wFriction])].sort((a,b)=>a-b);
 const base=new Map(primary.groups.map(g=>[JSON.stringify([g.service,g.borough]),g]));
 const result=[];
 for(const horizon of horizons){
  const run=analyze(rows,map,{...c,horizonDays:horizon});
  for(const w of weights){
   const groups=run.groups.map(g=>({...g,score:g.score===null?null:100*(w*g.friction+(1-w)*g.asymmetry)}));
   for(const g of groups){
    const old=base.get(JSON.stringify([g.service,g.borough]));
    const rank=g.score===null?null:1+groups.filter(x=>x.service===g.service&&x.score!==null&&x.score>g.score+1e-10).length;
    result.push({service:g.service,borough:g.borough,horizonDays:horizon,frictionWeight:w,primary:horizon===c.horizonDays&&w===c.wFriction,eligibleTotal:run.counts.eligible,n:g.n,peerN:g.peerN,nonclosure:g.nonclosure30,delayBurden:g.delayBurden30,friction:g.friction,peerFriction:g.peerFriction,signedDifference:g.peerFriction===null||g.friction===null?null:g.friction-g.peerFriction,asymmetry:g.asymmetry,score:g.score,rankWithinService:rank,deltaFromPrimary:old?.score!=null&&g.score!==null?g.score-old.score:null,sameEligibleCountAsPrimary:run.counts.eligible===primary.counts.eligible,warning:g.warning});
   }
  }
 }
 return {schema:'govfriction-sensitivity-1',engine:primary.protocol,source:primary.source,config:c,horizons,weights,notes:['Horizon changes may change eligible cohorts; inspect counts before interpreting differences.','Weights vary friction versus absolute asymmetry, not the fixed 50/50 components within friction.','No composite confidence intervals or significance tests.','Unscorable groups remain null; ranks are within service only.'],rows:result};
}
export function academicTable(report){
 return report.groups.map(g=>({service:g.service,borough:g.borough,n:g.n,nonclosure_pct:g.nonclosure30===null?null:100*g.nonclosure30,wilson_low_pct:g.wilsonLow===null?null:100*g.wilsonLow,wilson_high_pct:g.wilsonHigh===null?null:100*g.wilsonHigh,delay_burden_pct:g.delayBurden30===null?null:100*g.delayBurden30,friction:g.friction,peer_friction:g.peerFriction,signed_difference:g.peerFriction===null||g.friction===null?null:g.friction-g.peerFriction,bfs_dai:g.score,warning:g.warning,source_sha256:report.source?.sha256,synthetic:!!report.source?.synthetic}));
}
export function methodsText(report){
 const m=report.methods??methodsRecord(report,null);
 return ['# Methods and reporting record',m.source.synthetic?'SYNTHETIC DEMONSTRATION — NOT EMPIRICAL EVIDENCE':'USER-UPLOADED DATA — provenance not independently verified',m.protocolStatus,'Engine: '+m.engine,'Formula: '+m.formula,'Source: '+JSON.stringify(m.source),'Configuration: '+JSON.stringify(m.config),'Mapping: '+JSON.stringify(m.mapping),'Audit: '+JSON.stringify(m.counts),'Eligibility: '+m.eligibility,'Uncertainty: '+m.uncertainty,'## Limitations',...m.limitations.map(x=>'- '+x),'## Citation',m.citation].join('\n\n');
}
export function initScholarlyMode({getState,download}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const section=el('div');section.className='research-scholarly';section.style.marginTop='1.5rem';
 section.append(el('h3','Scholarly research protocol'),el('p','Freeze research settings before running the primary analysis. A local record is not external preregistration.'));
 const fields=[];
 for(const [title,value] of [['Research question','How do recorded processing friction and within-service geographical asymmetry vary across NYC boroughs for DSNY graffiti and missed collection requests in Q1 2025?'],['Hypotheses / planned contrasts','Compare nonclosure and recorded delay within each service; descriptive, not causal.'],['Official source URL','https://data.cityofnewyork.us/Social-Services/311-Service-Requests/erm2-nwe9']]){
  const label=el('label',title),input=el('textarea');input.rows=2;input.value=value;label.append(input);section.append(label);fields.push(input);
 }
 const status=el('p','No local protocol frozen.'),actions=el('div');actions.className='actions';section.append(actions,status);
 const button=(parent,title,fn)=>{const b=el('button',title);b.type='button';b.className='secondary';b.addEventListener('click',fn);parent.append(b);return b};
 let frozen=null,sens=null;
 button(actions,'Freeze local protocol',()=>{try{const state=getState();if(state.report)throw Error('Analysis already exists. Re-import the original CSV to create a new local protocol; disclose any prior exploration.');frozen=freezeProtocol(state,...fields.map(x=>x.value));status.textContent='Local protocol frozen for current settings and source hash.';}catch(e){status.textContent=e.message}});
 button(actions,'Download protocol JSON',()=>{if(!frozen){status.textContent='Freeze a protocol first.';return}download(JSON.stringify(frozen,null,2),'govfriction-protocol.json','application/json')});
 document.getElementById('methods').append(section);
 const out=el('div');out.style.marginTop='1.5rem';out.append(el('h3','Scholarly exports and sensitivity lab'),el('p','Compare 15/30/45/60/90-day horizons and friction/asymmetry weights; includes primary settings. Review eligibility counts. No composite intervals are estimated.'));
 const buttons=el('div');buttons.className='actions';out.append(buttons);const message=el('p','Run an audited analysis first.');out.append(message);
 const grid=el('div');grid.className='tablewrap';out.append(grid);
 document.getElementById('results').append(out);
 const current=()=>{const s=getState();if(!s.report)throw Error('Run audited analysis first.');return s};
 const guard=fn=>()=>{try{fn(current())}catch(e){message.textContent=e.message}};
 button(buttons,'Methods report (.md)',guard(s=>download(methodsText(s.report),'govfriction-methods.md','text/markdown')));
 button(buttons,'Academic results table (.csv)',guard(s=>download(exportCSV(academicTable(s.report)),'govfriction-academic-table.csv','text/csv')));
 button(buttons,'Run sensitivity analysis',guard(s=>{
  sens=null;grid.replaceChildren();
  if(!s.report.source?.sha256||s.sha!==s.report.source.sha256)throw Error('Frozen input hash unavailable or changed. Re-import and analyze.');
  sens=sensitivity(s.dataset.data,s.report.mapping,s.report);
  message.textContent=(s.report.source.synthetic?'SYNTHETIC — ':'')+sens.rows.length+' group-specification rows. Showing up to 50; export all rows. Horizon changes can alter eligible cohorts.';
  const table=el('table'),head=el('thead'),tr=el('tr');
  for(const title of ['Service','Borough','Horizon','Friction weight','n','Eligible total','Score','Rank','Delta'])tr.append(el('th',title));head.append(tr);table.append(head);
  const body=el('tbody');for(const r of sens.rows.slice(0,50)){const row=el('tr');for(const v of [r.service,r.borough,r.horizonDays,r.frictionWeight,r.n,r.eligibleTotal,r.score?.toFixed(3),r.rankWithinService,r.deltaFromPrimary?.toFixed(3)])row.append(el('td',v??'—'));body.append(row)}table.append(body);grid.append(table);
 }));
 button(buttons,'Sensitivity CSV',guard(()=>{if(!sens)throw Error('Run sensitivity analysis first.');download(exportCSV(sens.rows.map(r=>({...r,source_sha256:sens.source.sha256,synthetic:sens.source.synthetic,engine:sens.engine}))),'govfriction-sensitivity.csv','text/csv')}));
 button(buttons,'Sensitivity JSON',guard(()=>{if(!sens)throw Error('Run sensitivity analysis first.');download(JSON.stringify(sens,null,2),'govfriction-sensitivity.json','application/json')}));
 return {frozen:()=>frozen,reset:()=>{frozen=null;sens=null;grid.replaceChildren();status.textContent='No local protocol frozen.';message.textContent='Run an audited analysis first.'},onReport:()=>{sens=null;grid.replaceChildren();message.textContent=getState().report.methods.protocolStatus;}};
}
