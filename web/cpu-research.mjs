/* Browser-CPU analytical workstation: pure research functions, no server requests. */
import {preparePredictionRows} from "./prediction.mjs";
const DAY=86400000;
function wilson(k,n){
 if(!n)return [null,null];
 const z=1.959963984540054,p=k/n,den=1+z*z/n,center=(p+z*z/(2*n))/den;
 const half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
 return [Math.max(0,center-half),Math.min(1,center+half)];
}
function compare(a,b){return a.name.localeCompare(b.name)}
function survivalCurve(rows,horizon){
 // Kaplan–Meier product-limit estimate: events are recorded closures,
 // open or late closures are right-censored at the follow-up horizon.
 const outcomes=rows.map(r=>({t:r.observationDays,event:r.observedClosure})).sort((a,b)=>a.t-b.t);
 let atRisk=outcomes.length,survival=1,greenwood=0,medianDays=null,i=0;
 const track=[{day:0,remaining:1,lower95:1,upper95:1,nRisk:atRisk,closures:0}];
 while(i<outcomes.length){
  const t=outcomes[i].t;let d=0,censored=0;
  while(i<outcomes.length&&outcomes[i].t===t){
   if(outcomes[i].event)d++;else censored++;i++;
  }
  if(d>0){
   survival*=1-d/atRisk;
   if(atRisk>d)greenwood+=d/(atRisk*(atRisk-d));
   if(medianDays===null&&survival<=0.5)medianDays=t;
   const se=survival*Math.sqrt(greenwood);
   track.push({day:t,remaining:survival,lower95:Math.max(0,survival-1.959963984540054*se),
    upper95:Math.min(1,survival+1.959963984540054*se),nRisk:atRisk,closures:d});
  }
  atRisk-=d+censored;
 }
 const byDay=[0,7,14,horizon].filter((v,i,a)=>v<=horizon&&a.indexOf(v)===i).map(day=>{
  let point=track[0];for(const candidate of track){if(candidate.day>day)break;point=candidate}
  return {day,remaining:point.remaining,lower95:point.lower95,upper95:point.upper95};
 });
 return {n:rows.length,medianClosedDays:medianDays,byDay,
  note:"Greenwood normal-approximation uncertainty is exploratory; small strata can be unstable."};
}
export function analyzeCPU(rows,mapping,settings){
 const {ready,audit,config}=preparePredictionRows(rows,mapping,settings);
 if(!ready.length)throw Error("No eligible records for CPU analysis.");
 if(ready.length>200000)throw Error("CPU pilot limit: 200,000 eligible cases. Split into frozen cohorts for audit.");
 const groups=new Map(),monthly=new Map(),byService=new Map();
 for(const r of ready){
  const key=r.service+"\u001f"+r.borough;
  if(!groups.has(key))groups.set(key,{name:r.borough,service:r.service,n:0,nonclosed:0,closed:0});
  const g=groups.get(key);g.n++;if(r.label)g.nonclosed++;else g.closed++;
  const month=new Date(r.created).toISOString().slice(0,7),mkey=r.service+"\u001f"+month;
  if(!monthly.has(mkey))monthly.set(mkey,{service:r.service,month,n:0,nonclosed:0});
  const m=monthly.get(mkey);m.n++;m.nonclosed+=r.label;
  if(!byService.has(r.service))byService.set(r.service,[]);
  byService.get(r.service).push(r);
 }
 const grouped=[...groups.values()].sort((a,b)=>a.service.localeCompare(b.service)||compare(a,b)).map(g=>{
  const [low,high]=wilson(g.nonclosed,g.n);
  return {...g,rate:g.nonclosed/g.n,wilson95Low:low,wilson95High:high};
 });
 const trends=[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.service.localeCompare(b.service))
  .map(m=>({...m,rate:m.nonclosed/m.n,...(()=>{const [low,high]=wilson(m.nonclosed,m.n);return {wilson95Low:low,wilson95High:high}})()}));
 const survival=[...byService].map(([service,cases])=>({service,...survivalCurve(cases,config.horizonDays)}));
 const aggregateByService=[...byService.keys()].sort().map(service=>({
  service,groups:grouped.filter(g=>g.service===service).map(g=>({name:g.name,closed:g.closed,nonclosed:g.nonclosed}))
 }));
 return {protocol:"govfriction-browser-cpu-v0.4",audit,eligible:ready.length,groups:grouped,trends,
  survival,aggregateByService,
  caveats:["Only documented closure is observed; physical issue resolution is unknown.",
   "Group proportions use Wilson intervals; statistical significance is not proof of cause.",
   "Time-to-closure is right-censored at the selected follow-up horizon.",
   "No categorical data from the user is uploaded unless the separate Cloudflare aggregate button is explicitly used.",
   "Poisson or negative-binomial forecasting requires a sufficiently long real time series; not provided by a 3-month pilot."]};
}