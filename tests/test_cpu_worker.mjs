import {strict as assert} from "node:assert";
import runtime from "../src/index.mjs";
import {contingencyAnalysis} from "../src/statistics.mjs";
import {analyzeCPU} from "../web/cpu-research.mjs";
import {autoMap} from "../web/engine.mjs";

const env={
 APP_MODE:"research-pilot",
 ENABLE_SERVER_ANALYTICS:"true",
 MAX_AGGREGATE_GROUPS:"12",
 OPENROUTER_API_KEY:"TOP_SECRET_DO_NOT_EXPOSE",
 ASSETS:{fetch:async()=>new Response("<!doctype html><h1>GovFriction Lab</h1>",{headers:{"content-type":"text/html"}})}
};
const call=(url,options)=>runtime.fetch(new Request(url,options),env,{});
const base="https://govfriction.mabrigkorie.org";
let response=await call(base+"/api/health");
assert.equal(response.status,200);
const health=await response.json();
assert.equal(health.runtime,"cloudflare-worker");
assert.equal(health.serverAggregateAnalysis,true);
assert.equal(health.backendStorage,"not configured");
assert.equal(JSON.stringify(health).includes("TOP_SECRET"),false);
assert.equal((await call(base+"/")).status,200);
response=await call(base+"/api/analysis/contingency",{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify({groups:[{name:"Bronx",nonclosed:10,closed:20},{name:"Queens",nonclosed:20,closed:10}]})});
assert.equal(response.status,200);
let value=await response.json();
assert.ok(Math.abs(value.chiSquare-6.666666666666667)<1e-8);
assert.ok(Math.abs(value.pValue-0.009823274507519249)<1e-6);
assert.ok(Math.abs(value.cramersV-Math.sqrt(6.666666666666667/60))<1e-8);
assert.ok(value.assumptionsPass);
assert.equal(value.groups[0].n,30);
assert.equal((await call(base+"/api/analysis/contingency",{method:"POST",headers:{"content-type":"application/json",origin:"https://untrusted.example"},body:'{"groups":[]}'})).status,403);
assert.equal((await call(base+"/api/analysis/contingency",{method:"POST",headers:{"content-type":"application/json"},body:'{"groups":[{"name":"ONE","nonclosed":100,"closed":1},{"name":"TWO","nonclosed":0,"closed":1}]}'})).status,200);
value=contingencyAnalysis({groups:[{name:"a",nonclosed:9,closed:1},{name:"b",nonclosed:0,closed:1}]});
assert.equal(value.pValue,null,"Withhold asymptotic p when expected cell counts too small");
assert.throws(()=>contingencyAnalysis({groups:[{name:"a",nonclosed:1,closed:2},{name:"a",nonclosed:2,closed:1}]}),/unique/);
assert.throws(()=>contingencyAnalysis({groups:[{name:"a",nonclosed:-1,closed:2},{name:"b",nonclosed:2,closed:1}]}),/nonnegative/);

const names=['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND'],rows=[];
for(let i=0;i<900;i++){
 const created=Date.UTC(2025,0,1)+(i%90)*86400000;
 const late=(i%11===0)||(i%7===0);
 const closed=late?'':new Date(created+(2+i%20)*86400000).toISOString().slice(0,19);
 rows.push({unique_key:'R'+i,created_date:new Date(created).toISOString().slice(0,19),closed_date:closed,
 agency:"DSNY",complaint_type:i%2?"Graffiti":"Missed Collection (All Materials)",borough:names[i%5],status:closed?"Closed":"Open"});
}
const mapping=autoMap(Object.keys(rows[0]));
const analysis=analyzeCPU(rows,mapping,{});
assert.equal(analysis.eligible,900);
assert.equal(analysis.groups.length,10);
assert.equal(analysis.survival.length,2);
assert.equal(analysis.trends.length,6);
assert.equal(analysis.aggregateByService.length,2);
assert.ok(analysis.groups.every(g=>g.wilson95Low<=g.rate&&g.rate<=g.wilson95High));
assert.ok(analysis.survival.every(x=>x.byDay.length>=3&&x.byDay.every((v,j,a)=>j===0||v.remaining<=a[j-1].remaining)));
assert.equal(analysis.aggregateByService[0].groups.reduce((s,g)=>s+g.closed+g.nonclosed,0),450);
console.log("PASS Cloudflare Worker API, variables, secrets isolation, chi-square, Cramér V, Wilson intervals, CPU cohort and Kaplan–Meier");