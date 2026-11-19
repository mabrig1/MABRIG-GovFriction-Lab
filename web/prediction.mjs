/* Transparent, browser-only pilot models: prediction of documented nonclosure at horizon.
   Predictors are strictly available at record creation. No external model APIs. */
import {DEFAULTS,timestamp} from './engine.mjs';
const DAY=86400000;
const BOROUGHS=['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND'];
const sigmoid=x=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));
const clamp=p=>Math.min(1-1e-12,Math.max(1e-12,p));
const featureNames=['Intercept','Graffiti vs missed collection','Brooklyn vs Bronx','Manhattan vs Bronx','Queens vs Bronx','Staten Island vs Bronx','Weekday sine','Weekday cosine','Hour sine','Hour cosine'];
function validateOptions(cfg){
 const start=timestamp(cfg.from),end=timestamp(cfg.to),snapshot=timestamp(cfg.snapshot);
 if(![start,end,snapshot].every(Number.isFinite)||start>=end||
 !Number.isInteger(cfg.horizonDays)||cfg.horizonDays<1||cfg.horizonDays>365)throw Error('Invalid prediction protocol dates or horizon.');
 return {start,end,snapshot};
}
export function preparePredictionRows(rows,mapping,custom={}){
 const cfg={...DEFAULTS,...custom};
 const {start,end,snapshot}=validateOptions(cfg);
 const essential=['id','created','closed','agency','service','borough'];
 if(essential.some(k=>!mapping[k]))throw Error('Prediction needs request ID, creation, closure, agency, service and borough mappings.');
 if(new Set(essential.map(k=>mapping[k])).size!==essential.length)throw Error('Duplicate predictor column mappings.');
 const allowService=new Set(cfg.services),seen=new Set(),ready=[];
 const audit={input:rows.length,eligible:0,invalidCreated:0,duplicate:0,scopeExcluded:0,invalidLocationService:0,invalidClosed:0,immature:0};
 for(const row of rows){
  const v=key=>String(row[mapping[key]]??'').trim();
  const id=v('id'),created=timestamp(v('created'));
  if(!id||!Number.isFinite(created)){audit.invalidCreated++;continue}
  if(seen.has(id)){audit.duplicate++;continue}seen.add(id);
  const service=v('service'),borough=v('borough').toUpperCase();
  if(created<start||created>=end||v('agency').toUpperCase()!==String(cfg.agency).toUpperCase()||!allowService.has(service)){audit.scopeExcluded++;continue}
  if(!BOROUGHS.includes(borough)){audit.invalidLocationService++;continue}
  const rawClosed=v('closed'),closed=rawClosed?timestamp(rawClosed):null;
  if((rawClosed&&!Number.isFinite(closed))||(closed!==null&&closed<created)){audit.invalidClosed++;continue}
  if(created>snapshot){audit.scopeExcluded++;continue}
  if(snapshot-created<cfg.horizonDays*DAY){audit.immature++;continue}
  const days=closed===null||closed>snapshot?Infinity:(closed-created)/DAY;
  const t=new Date(created),dow=t.getUTCDay(),hour=t.getUTCHours();
  ready.push({created,service,borough,dow,hour,label:days>cfg.horizonDays?1:0});
 }
 audit.eligible=ready.length;
 return {ready,audit,config:cfg};
}
function vector(r){
 const v=[1,r.service==='Graffiti'?1:0];
 for(const borough of BOROUGHS.slice(1))v.push(r.borough===borough?1:0);
 v.push(Math.sin(2*Math.PI*r.dow/7),Math.cos(2*Math.PI*r.dow/7));
 v.push(Math.sin(2*Math.PI*r.hour/24),Math.cos(2*Math.PI*r.hour/24));
 return v;
}
function fitLogistic(train){
 const X=train.map(vector),y=train.map(r=>r.label),n=X.length,k=featureNames.length;
 const prevalence=y.reduce((a,b)=>a+b,0)/n;
 let weights=Array(k).fill(0);weights[0]=Math.log(clamp(prevalence)/clamp(1-prevalence));
 // Mean logistic cross entropy plus 0.03/2 * L2 penalty, excluding intercept.
 for(let step=0;step<240;step++){
  const gradient=Array(k).fill(0);
  for(let i=0;i<n;i++){
   const p=sigmoid(X[i].reduce((s,x,j)=>s+x*weights[j],0));
   const delta=p-y[i];
   for(let j=0;j<k;j++)gradient[j]+=delta*X[i][j];
  }
  const rate=0.65/Math.sqrt(1+step/120);
  for(let j=0;j<k;j++)weights[j]-=rate*(gradient[j]/n+(j?0.03*weights[j]:0));
 }
 return {predict:r=>sigmoid(vector(r).reduce((s,x,j)=>s+x*weights[j],0)),
   coefficients:featureNames.map((name,j)=>({name,beta:weights[j],oddsRatio:Math.exp(weights[j])}))};
}
function categories(row){return [row.service,row.borough,String(row.dow),String(Math.floor(row.hour/6))]}
function fitNaiveBayes(train){
 // Simple categorical Naive Bayes with additive smoothing; assumptions may not hold.
 const count=[0,0],bins=Array.from({length:2},()=>Array.from({length:4},()=>new Map()));
 const sizes=[2,5,7,4];
 for(const row of train){
  const y=row.label;count[y]++;
  categories(row).forEach((v,j)=>bins[y][j].set(v,(bins[y][j].get(v)||0)+1));
 }
 return {predict:row=>{
   const x=categories(row);
   const ll=[0,1].map(y=>{
    let result=Math.log((count[y]+1)/(train.length+2));
    for(let j=0;j<x.length;j++)result+=Math.log(((bins[y][j].get(x[j])||0)+1)/(count[y]+sizes[j]));
    return result;
   });
   return sigmoid(ll[1]-ll[0]);
 }};
}
function rocAuc(y,p){
 const n1=y.reduce((a,b)=>a+b,0),n0=y.length-n1;if(!n1||!n0)return null;
 const sorted=y.map((v,i)=>({v,p:p[i]})).sort((a,b)=>a.p-b.p);
 let sum=0,rank=1;
 for(let i=0;i<sorted.length;){
  let j=i+1;while(j<sorted.length&&sorted[j].p===sorted[i].p)j++;
  const avgRank=((i+1)+j)/2;
  for(let t=i;t<j;t++)if(sorted[t].v)sum+=avgRank;
  rank=j+1;i=j;
 }
 return (sum-n1*(n1+1)/2)/(n1*n0);
}
function calibration(y,p){
 const bins=Array.from({length:5},(_,i)=>({bin:i+1,lower:i/5,upper:(i+1)/5,n:0,probability:0,observed:0}));
 for(let i=0;i<y.length;i++){
  const b=bins[Math.min(4,Math.floor(p[i]*5))];
  b.n++;b.probability+=p[i];b.observed+=y[i];
 }
 return bins.map(b=>({...b,probability:b.n?b.probability/b.n:null,observed:b.n?b.observed/b.n:null}));
}
export function metrics(y,p){
 if(!Array.isArray(y)||!Array.isArray(p)||y.length!==p.length||!y.length)throw Error('Expected nonempty matching prediction arrays.');
 if(y.some(v=>v!==0&&v!==1)||p.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('Invalid labels or probabilities.');
 let tp=0,tn=0,fp=0,fn=0,brier=0,loss=0;
 for(let i=0;i<y.length;i++){
  const predicted=p[i]>=0.5?1:0,actual=y[i],q=clamp(p[i]);
  if(predicted&&actual)tp++;else if(predicted)fp++;else if(actual)fn++;else tn++;
  brier+=(p[i]-actual)**2;
  loss-=actual*Math.log(q)+(1-actual)*Math.log(1-q);
 }
 const n=y.length,precision=tp+fp?tp/(tp+fp):0,recall=tp+fn?tp/(tp+fn):0,
 specificity=tn+fp?tn/(tn+fp):0;
 return {n,events:y.reduce((s,x)=>s+x,0),accuracy:(tp+tn)/n,balancedAccuracy:(recall+specificity)/2,
   precision,recall,specificity,f1:precision+recall?2*precision*recall/(precision+recall):0,
   brier:brier/n,logLoss:loss/n,rocAuc:rocAuc(y,p),tp,tn,fp,fn,calibration:calibration(y,p)};
}
export function evaluatePredictionModels(rows,mapping,custom={}){
 const prepared=preparePredictionRows(rows,mapping,custom),cfg=prepared.config;
 const {start,end}=validateOptions(cfg),window=end-start,horizon=cfg.horizonDays*DAY;
 const testStart=start+Math.floor(window/DAY*2/3)*DAY,trainEnd=testStart-horizon;
 if(trainEnd<=start||end-testStart<7*DAY)throw Error('Prediction requires a longer study window: allow training, a full follow-up embargo and at least 7 days of holdout.');
 const train=prepared.ready.filter(r=>r.created<trainEnd);
 const test=prepared.ready.filter(r=>r.created>=testStart);
 const embargo=prepared.ready.length-train.length-test.length;
 const makeDate=ms=>new Date(ms).toISOString().slice(0,10);
 if(train.length<40||test.length<20)throw Error('Too few mature cases for temporal validation: need at least 40 training and 20 later test records (found '+train.length+' and '+test.length+').');
 const nEvents=train.reduce((a,r)=>a+r.label,0),testEvents=test.reduce((a,r)=>a+r.label,0);
 if(Math.min(nEvents,train.length-nEvents)<3||Math.min(testEvents,test.length-testEvents)<2)
  throw Error('Insufficient positive/negative examples in the temporal groups. Prediction is withheld rather than reporting misleading accuracy.');
 const baseRate=nEvents/train.length;
 const baseline={name:'Historical-rate baseline',predict:()=>baseRate};
 const logit=fitLogistic(train),bayes=fitNaiveBayes(train);
 const truth=test.map(r=>r.label);
 const modelResults=[baseline,{name:'L2-regularized logistic regression',...logit},{name:'Categorical Naive Bayes',...bayes}].map(model=>{
  const probabilities=test.map(model.predict),performance=metrics(truth,probabilities);
  return {name:model.name,metrics:performance,coefficients:model.coefficients||null};
 });
 return {protocol:'predictive-nonclosure-0.1',target:'Documented nonclosure by '+cfg.horizonDays+' days',
    sourceFeatures:['Service category','Borough','Request creation weekday','Request creation hour'],
    leakageExcluded:['closed_date','status','resolution_description','future case volume','future records'],
    split:{trainStart:makeDate(start),trainEndExclusive:makeDate(trainEnd),
      embargoStart:makeDate(trainEnd),holdoutStart:makeDate(testStart),holdoutEndExclusive:makeDate(end),
      horizonDays:cfg.horizonDays,trainingN:train.length,holdoutN:test.length,embargoN:embargo,
      trainingEventRate:baseRate,holdoutEventRate:testEvents/test.length},
    audit:prepared.audit,models:modelResults,
    notes:['Scores are measured on later held-out requests, not training records.',
     'A time embargo ensures all training request outcomes matured before the holdout period.',
     'Models use creation-time features only. Closure dates define the outcome, not a predictor.',
     'ROC-AUC measures ranking discrimination; Brier and log loss assess probability quality.',
     'A 0.5 decision threshold is fixed in advance, not optimized on the holdout.',
     'Synthetic demonstration metrics are not evidence of real-world prediction accuracy.',
     'No statistical significance test, confidence intervals or external cross-jurisdiction validation yet.',
     'No deployment, citizen risk flagging or individual decision automation is recommended on this pilot.']};
}