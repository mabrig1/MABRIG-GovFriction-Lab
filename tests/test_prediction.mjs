import {strict as assert} from 'node:assert';
import {autoMap} from '../web/engine.mjs';
import {preparePredictionRows,evaluatePredictionModels,metrics} from '../web/prediction.mjs';
const DAY=86400000;
const iso=(ms)=>new Date(ms).toISOString().slice(0,19);
const columns=['unique_key','created_date','closed_date','agency','complaint_type','borough','status'];
const map=autoMap(columns);
const rows=[];
for(let i=0;i<900;i++){
 const created=Date.UTC(2025,0,1)+(i%90)*DAY+(i%24)*3600000;
 const service=i%3===0?'Graffiti':'Missed Collection (All Materials)';
 const borough=['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND'][i%5];
 // Strong, nontrivial pattern with both outcomes per time period.
 const late=(i%11===0)||(i%7===0)||(borough==='QUEENS'&&i%3!==1);
 const closed=late?(i%11===0?'':iso(created+55*DAY)):iso(created+(3+i%18)*DAY);
 rows.push({unique_key:'R'+i,created_date:iso(created),closed_date:closed,agency:'DSNY',complaint_type:service,borough,status:closed?'Closed':'Open'});
}
const prepared=preparePredictionRows(rows,map);
assert.equal(prepared.audit.eligible,900);
const evaluated=evaluatePredictionModels(rows,map);
assert.equal(evaluated.models.length,3);
assert.ok(evaluated.split.trainingN>=40&&evaluated.split.holdoutN>=20);
assert.ok(new Date(evaluated.split.trainEndExclusive).getTime()+30*DAY<=new Date(evaluated.split.holdoutStart).getTime());
assert.equal(evaluated.split.trainingN+evaluated.split.holdoutN+evaluated.split.embargoN,900);
for(const model of evaluated.models){
 const m=model.metrics;
 assert.ok(m.accuracy>=0&&m.accuracy<=1);
 assert.ok(m.brier>=0&&m.brier<=1);
 assert.ok(m.logLoss>=0);
 assert.ok(m.rocAuc>=0&&m.rocAuc<=1);
 assert.equal(m.tp+m.tn+m.fp+m.fn,evaluated.split.holdoutN);
 assert.equal(m.calibration.reduce((s,x)=>s+x.n,0),evaluated.split.holdoutN);
}
assert.equal(evaluated.models[1].coefficients.length,10);
const mutated=rows.map(r=>({...r,status:'Different after study'}));
assert.deepEqual(evaluatePredictionModels(mutated,map).models,evaluated.models,'Current status should not be predictive input or training label');
const testStart=Date.parse(evaluated.split.holdoutStart);
const tampered=rows.map(r=>({...r,closed_date:Date.parse(r.created_date)>=testStart?'':r.closed_date}));
const altered=evaluatePredictionModels(tampered,map);
assert.deepEqual(altered.models[1].coefficients,evaluated.models[1].coefficients,'Held-out outcomes must not influence logistic coefficients');
assert.equal(altered.models[0].metrics.n,evaluated.models[0].metrics.n);
assert.notEqual(altered.models[0].metrics.events,evaluated.models[0].metrics.events);
const c=Date.UTC(2025,0,5);
const atBoundary={...rows[0],unique_key:'BOUNDARY',created_date:iso(c),closed_date:iso(c+30*DAY)};
const afterBoundary={...atBoundary,unique_key:'LATE',closed_date:iso(c+30*DAY+1000)};
const boundary=preparePredictionRows([atBoundary,afterBoundary],map);
assert.deepEqual(boundary.ready.map(x=>x.label),[0,1]);
assert.equal(metrics([0,1],[0.1,0.9]).accuracy,1);
assert.equal(metrics([0,1],[0.5,0.5]).rocAuc,0.5);
assert.equal(metrics([0,1],[0,1]).brier,0);
assert.throws(()=>evaluatePredictionModels(rows.slice(0,19),map),/Too few|Insufficient/);
assert.equal(preparePredictionRows([...rows,{...rows[0]}],map).audit.duplicate,1);
console.log('PASS: 3 statistical models, temporal embargo, data maturity, leakage protection, boundary and probability diagnostics');