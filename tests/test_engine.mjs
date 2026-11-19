import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {parseCSV,autoMap,analyze,timestamp,compareReports,exportCSV} from '../web/engine.mjs';
const text='unique_key,created_date,closed_date,agency,complaint_type,borough,status\n'+
 'A,2025-01-01T00:00:00,2025-01-01T00:00:00,DSNY,Graffiti,QUEENS,Closed\n'+
 'B,2025-01-01T00:00:00,2025-01-16T00:00:00,DSNY,Graffiti,QUEENS,Closed\n'+
 'C,2025-01-01T00:00:00,2025-01-31T00:00:00,DSNY,Graffiti,QUEENS,Closed\n'+
 'D,2025-01-01T00:00:00,,DSNY,Graffiti,QUEENS,Open\n'+
 'E,2025-01-01T00:00:00,2025-01-02T00:00:00,DSNY,Graffiti,BRONX,Closed\n'+
 'F,2025-01-01T00:00:00,2025-01-02T00:00:00,DSNY,Graffiti,BRONX,Closed\n';
const parsed=parseCSV(text),mapping=autoMap(parsed.headers);
const result=analyze(parsed.data,mapping,{minN:1});
const q=result.groups.find(r=>r.borough==='QUEENS');
assert.equal(q.n,4);assert.equal(q.lateCount,1);assert.equal(q.nonclosure30,0.25);
assert.equal(q.delayBurden30,(0+0.5+1+1)/4);
assert.equal(result.counts.eligible,6);
assert.equal(analyze([...parsed.data,parsed.data[0]],mapping,{minN:1}).counts.duplicate,1);
assert.equal(analyze([...parsed.data,{...parsed.data[0],unique_key:'BAD',closed_date:'2024-01-01T00:00:00'}],mapping,{minN:1}).counts.invalidClosed,1);
assert.equal(Number.isNaN(timestamp('2025-02-31T00:00:00')),true);
assert.equal(timestamp('01/31/2025 01:30:00 PM'),Date.UTC(2025,0,31,13,30));
const parsedQuoted=parseCSV('name,value\n"one,two","a ""quote"""\n');
assert.equal(parsedQuoted.data[0].name,'one,two');
assert.equal(parsedQuoted.data[0].value,'a "quote"');
assert.match(exportCSV([{service:'=SUM(1,2)',score:1}]),/'=SUM/);
const sha=createHash('sha256').update(text).digest('hex');
const ref=result.groups.map(r=>({...r,source_sha256:sha}));
assert.equal(compareReports(result.groups,ref,sha,sha).ok,true);
assert.equal(compareReports(result.groups,ref,sha,'bad').ok,false);
assert.equal(compareReports(result.groups,ref.map((r,i)=>i===0?{...r,source_sha256:'wrong'}:r),sha,sha).ok,false);
console.log('PASS: formula boundaries, exclusions, strict CSV, checksum parity and injection prevention');