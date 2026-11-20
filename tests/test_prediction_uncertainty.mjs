import {strict as assert} from "node:assert";
import {pairedDayBootstrap} from "../web/prediction-uncertainty.mjs";
import {evaluatePredictionModels} from "../web/prediction.mjs";
import {autoMap} from "../web/engine.mjs";

const DAY=86400000;
const cases=Array.from({length:100},(_,i)=>({
  created:Date.UTC(2025,2,1+Math.floor(i/5))
}));
const y=cases.map((_,i)=>(i%9===0||i%9===1)?1:0);
const forecasts=[
 {name:"Historical-rate baseline",probabilities:y.map(()=>0.23)},
 {name:"Improved",probabilities:y.map(label=>label?0.7:0.12)},
 {name:"Same as baseline",probabilities:y.map(()=>0.23)}
];
const a=pairedDayBootstrap(cases,y,forecasts),b=pairedDayBootstrap(cases,y,forecasts);
assert.deepEqual(a,b,"Fixed seed and frozen out-of-time probabilities must give byte-for-byte reproducibility");
assert.equal(a.status,"estimated");assert.equal(a.n,100);assert.equal(a.distinctDays,20);
assert.equal(a.replications,499);assert.equal(a.estimates.length,3);
assert.equal(a.estimates[0].brierImprovementVsBaseline,0);
assert.deepEqual(a.estimates[0].improvement95,{lower:0,upper:0});
assert.equal(a.estimates[1].brierImprovementVsBaseline>0,true);
assert.ok(a.estimates[1].improvement95.lower>0);
assert.equal(a.estimates[2].brierImprovementVsBaseline,0);
assert.equal(a.estimates[0].brier95.lower<=a.estimates[0].brier,true);
assert.equal(a.estimates[0].brier95.upper>=a.estimates[0].brier,true);
assert.ok(a.estimates.every(x=>x.brier95.upper>=x.brier95.lower));
assert.notDeepEqual(a,pairedDayBootstrap(cases,y,forecasts,{seed:2000}));
assert.equal(pairedDayBootstrap(cases.map(x=>({...x,created:cases[0].created})),y,forecasts).status,"insufficient-distinct-days");
assert.throws(()=>pairedDayBootstrap(cases,y,forecasts.slice(0,1)),/Invalid/);
assert.throws(()=>pairedDayBootstrap(cases,y.slice(1),forecasts),/Invalid/);
assert.throws(()=>pairedDayBootstrap(cases,y,[forecasts[0],{name:"Invalid",probabilities:y.map(()=>NaN)}]),/Unusable/);
assert.throws(()=>pairedDayBootstrap(cases,y,forecasts,{replications:10}),/Invalid/);
assert.throws(()=>pairedDayBootstrap(cases.map(x=>({...x,created:NaN})),y,forecasts),/creation dates/);

// Full model integration: no raw holdout probabilities should leak into the public
// report; uncertainty remains conditional on frozen models and is reproducible.
const columns=["unique_key","created_date","closed_date","agency","complaint_type","borough","status"];
const mapping=autoMap(columns),study=[];
const iso=x=>new Date(x).toISOString().slice(0,19);
for(let i=0;i<900;i++){
  const created=Date.UTC(2025,0,1)+(i%90)*DAY+(i%24)*3600000;
  const late=i%7===0||i%11===0;
  const closed=late?"":iso(created+(i%17+3)*DAY);
  study.push({unique_key:"case-"+i,created_date:iso(created),closed_date:closed,
    agency:"DSNY",complaint_type:i%2?"Graffiti":"Missed Collection (All Materials)",
    borough:["BRONX","BROOKLYN","MANHATTAN","QUEENS","STATEN ISLAND"][i%5],status:closed?"Closed":"Open"});
}
const result=evaluatePredictionModels(study,mapping);
assert.equal(result.uncertainty.status,"estimated");
assert.equal(result.uncertainty.estimates.length,3);
assert.equal(result.uncertainty.n,result.split.holdoutN);
assert.equal(result.uncertainty.distinctDays>=8,true);
for(let i=0;i<result.models.length;i++){
  assert.equal(result.uncertainty.estimates[i].name,result.models[i].name);
  assert.ok(Math.abs(result.uncertainty.estimates[i].brier-result.models[i].metrics.brier)<1e-8);
  assert.ok(!Object.hasOwn(result.models[i],"probabilities"),"Holdout per-case probabilities must not be included in export");
}
const second=evaluatePredictionModels(study,mapping);
assert.deepEqual(second.uncertainty,result.uncertainty);
console.log("PASS: reproducible paired UTC-day bootstrap intervals, baseline differences and leak-safe full prediction pipeline");
