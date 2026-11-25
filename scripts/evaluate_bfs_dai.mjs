// Controlled Chromium core-engine evaluation; not a usability or security certification.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const input=process.env.GOVFRICTION_CSV;
const snapshot=process.env.GOVFRICTION_SNAPSHOT||'2026-11-19';
const sourceURL='https://data.cityofnewyork.us/d/erm2-nwe9';
const fixture=(n)=>{
 const head='unique_key,created_date,closed_date,agency,complaint_type,borough,status';
 const regions=['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND'];
 const rows=Array.from({length:n},(_,i)=>{
  const b=regions[i%5],s=Math.floor(i/5)%2?'Graffiti':'Missed Collection (All Materials)';
  const created=new Date(Date.UTC(2025,0,1+i%89));
  const closed=new Date(created.getTime()+((i*7)%71)*86400000);
  return ['SYN-'+i,created.toISOString().slice(0,19),i%13?closed.toISOString().slice(0,19):'','DSNY',s,b,i%13?'Closed':'Open'].join(',');
 });
 rows.push(rows[0],'BAD,not-a-date,,DSNY,Graffiti,BRONX,Open','BAD-CLOSE,2025-01-01,2024-12-31,DSNY,Graffiti,BRONX,Closed','OUT,2025-01-01,,NYPD,Graffiti,BRONX,Open','BAD-GEO,2025-01-01,,DSNY,Graffiti,Unknown,Open','MISSING-CLOSE,2025-01-01,,DSNY,Graffiti,BRONX,Closed','malformed,record');
 return Buffer.from('\uFEFF'+[head,...rows].join('\r\n')+'\r\n');
};
const sha=b=>createHash('sha256').update(b).digest('hex');
const key=r=>JSON.stringify([r.service,r.borough,r.horizonDays,r.frictionWeight]);
const numeric=['nonclosure','delayBurden','friction','peerFriction','signedDifference','asymmetry','score'];
const exact=['n','peerN','eligibleTotal','rankWithinService'];
const temp=mkdtempSync(join(tmpdir(),'govfriction-eval-'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try{
 const page=await browser.newPage();
 // Evaluate loaded modules in a real browser against the same byte stream.
 await page.goto('http://127.0.0.1:8788/web/',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{window.evalEngine=await import('/web/engine.mjs');window.evalScholarly=await import('/web/scholarly.mjs')});
 const browserVersion=browser.version();
 for(const size of input?[null]:[1000,10000,50000]){
  const bytes=input?readFileSync(input):fixture(size);
  const file=join(temp,'data.csv');writeFileSync(file,bytes);
  const synthetic=!input;
  let provenance=null;
  if(input){
   if(!process.env.GOVFRICTION_MANIFEST)throw Error('Real-data evaluation requires GOVFRICTION_MANIFEST');
   provenance=JSON.parse(readFileSync(process.env.GOVFRICTION_MANIFEST,'utf8'));
   assert.equal(provenance.sha256,sha(bytes),'Manifest byte hash mismatch');
   assert.equal(provenance.dataset_id,'erm2-nwe9');
   assert.equal(provenance.truncated_for_exploration,false,'Truncated source not permitted');
   assert.ok(provenance.extraction_finished_utc,'Record extraction timestamp in manifest');
   assert.ok(snapshot<=provenance.extraction_finished_utc.slice(0,10),'Snapshot cannot postdate retrieval');
  }
  const requests=[];const listener=req=>requests.push({method:req.method(),origin:new URL(req.url()).origin,resourceType:req.resourceType()});
  page.on('request',listener);
  let got;
  try{
   got=await page.evaluate(async({encoded,snapshot,synthetic,sourceURL})=>{
    const {parseCSV,autoMap,analyze}=window.evalEngine;
    const {sensitivity,methodsRecord,freezeProtocol,academicTable}=window.evalScholarly;
    const bytes=Uint8Array.from(atob(encoded),x=>x.charCodeAt(0));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    const text=new TextDecoder().decode(bytes),config={snapshot};
    const run=()=>{
     const t0=performance.now(),dataset=parseCSV(text),mapping=autoMap(dataset.headers),t1=performance.now();
     const protocol=freezeProtocol({dataset,mapping,sha:hash,config,synthetic},'Compare documented processing friction','Descriptive',sourceURL);
     const report=analyze(dataset.data,mapping,config),t2=performance.now();
     report.source={sha256:hash,synthetic,parsedRows:dataset.data.length,malformedCSVRows:dataset.malformed};report.mapping=mapping;report.methods=methodsRecord(report,protocol);
     const sens=sensitivity(dataset.data,mapping,report),t3=performance.now();
     return {report,sens,table:academicTable(report),timing:{parse_ms:t1-t0,primary_ms:t2-t1,sensitivity_ms:t3-t2}};
    };
    run(); // warm-up excluded
    const timings=[];let last;
    for(let i=0;i<5;i++){last=run();timings.push(last.timing)}
    return {...last,timings};
   },{encoded:bytes.toString('base64'),snapshot,synthetic,sourceURL});
  }finally{page.off('request',listener)}
  const reference=spawnSync(process.env.PYTHON||'python',[join(root,'reference/bfs_dai_evaluate.py'),file,snapshot],{encoding:'utf8',maxBuffer:20*1024*1024});
  assert.equal(reference.status,0,reference.stderr||'Python failed');
  const expected=JSON.parse(reference.stdout);
  assert.equal(got.report.source.sha256,expected.source_sha256);
  assert.equal(got.report.source.sha256,sha(bytes));
  assert.equal(got.report.source.parsedRows,expected.parsed_rows);
  assert.equal(got.report.source.malformedCSVRows,expected.malformed_csv_rows);
  if(provenance)assert.equal(provenance.rows,expected.parsed_rows+expected.malformed_csv_rows);
  assert.deepEqual(got.report.counts,expected.primary_counts);
  assert.equal(got.report.methods.protocolStatus,'Matches local frozen protocol');
  assert.equal(got.report.methods.source.synthetic,synthetic);
  assert.equal(got.table.length,got.report.groups.length);
  const expectedRows=new Map(expected.rows.map(r=>[key(r),r]));
  assert.equal(expectedRows.size,expected.rows.length);
  assert.equal(got.sens.rows.length,expectedRows.size);
  let maxError=0;
  for(const r of got.sens.rows){
   const e=expectedRows.get(key(r));assert.ok(e,'Unexpected group/specification');
   for(const field of exact)assert.equal(r[field],e[field],field);
   for(const field of numeric){
    if(e[field]===null){assert.equal(r[field],null,field);continue}
    assert.ok(Number.isFinite(r[field]),field);
    const err=Math.abs(r[field]-e[field]);maxError=Math.max(err,maxError);
    assert.ok(err<=(field==='score'?1e-7:1e-9),field+' difference '+err);
   }
   expectedRows.delete(key(r));
  }
  assert.equal(expectedRows.size,0);
  assert.equal(requests.length,0,'Unexpected network request during core execution');
  const med=field=>got.timings.map(t=>t[field]).sort((a,b)=>a-b)[2];
  const evidence={synthetic,nominal_fixture_size:size,source_sha256:sha(bytes),bytes:bytes.length,parsed_rows:expected.parsed_rows,malformed_rows:expected.malformed_csv_rows,audit:expected.primary_counts,groups:got.report.groups.length,group_specifications:got.sens.rows.length,max_absolute_numeric_difference:maxError,core_network_requests:requests.length,median_ms:{parse:med('parse_ms'),primary_with_protocol:med('primary_ms'),sensitivity:med('sensitivity_ms')},all_timings_ms:got.timings,source_manifest:provenance};
  results.push(evidence);
  console.log('BFS-DAI_EVALUATION '+JSON.stringify(evidence));
 }
 const evidence={schema:'bfs-dai-evaluation-1',engine:'bfs-dai-0.1',browser:browserVersion,node:process.version,python:spawnSync(process.env.PYTHON||'python',['--version'],{encoding:'utf8'}).stdout.trim(),os:os.platform()+' '+os.release(),cpu:os.cpus()[0]?.model,cpu_count:os.cpus().length,memory_bytes:os.totalmem(),snapshot,software_commit:process.env.GITHUB_SHA||spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),limits:['One machine and Chromium engine; timing includes protocol work but excludes transfer, rendering and download.','Zero observed requests during controlled core module execution is not a comprehensive privacy audit.','No comparative usability or causal validity established.'],results};
 if(process.env.GOVFRICTION_EVIDENCE)writeFileSync(process.env.GOVFRICTION_EVIDENCE,JSON.stringify(evidence,null,2));
 console.log('BFS-DAI_ENVIRONMENT '+JSON.stringify({...evidence,results:undefined}));
 console.log('PASS: independent Python parity, audit and controlled browser performance');
}finally{await browser.close();rmSync(temp,{recursive:true,force:true})}
