import {autoMap,parseCSV,analyze,exportCSV,compareReports,DEFAULTS} from './engine.mjs';
import {evaluatePredictionModels} from './prediction.mjs';
import {initResearchLabs} from './extra-labs.mjs';
const $=id=>document.getElementById(id);
let dataset=null,mapping=null,report=null,prediction=null,cpuResult=null,backendReady=false,sha=null,filename='';
const required=['id','created','closed','agency','service','borough'];
const titles={id:'Request ID',created:'Creation timestamp',closed:'Closure timestamp',agency:'Agency',service:'Service / problem',borough:'Borough',status:'Recorded status (optional)'};
const int=n=>Number.isFinite(n)?n.toLocaleString('en-US'):'—';
const pct=n=>n===null||n===undefined?'—':(100*n).toFixed(1)+'%';
const dec=n=>n===null||n===undefined||!Number.isFinite(n)?'—':n.toFixed(2);
const make=(tag,cls='',value='')=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=String(value);return node};
const syntheticLabel='SYNTHETIC demonstration — not NYC observations.csv';
async function hashText(text){
 if(!globalThis.crypto?.subtle)return null;
 const bytes=new TextEncoder().encode(text),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function loadCSV(text,name){
 const parsed=parseCSV(text);
 dataset=parsed;mapping=autoMap(parsed.headers);filename=name;sha=await hashText(text);report=null;prediction=null;cpuResult=null;
 $('results').hidden=true;$('cpu').hidden=true;$('cpuoutput').hidden=true;$('cpucompareout').textContent='Independent CPU comparison not yet run.';$('predict').hidden=true;$('predictresults').hidden=true;$('predictcomparison').textContent='No independent prediction report uploaded.';$('analyze').disabled=false;$('mapping').hidden=false;
 $('filemeta').textContent=name+' · '+int(parsed.data.length)+' parsed rows · '+int(parsed.malformed)+' malformed CSV rows · SHA-256: '+(sha||'Unavailable. Serve the page via HTTPS or localhost.');
 $('compareout').textContent='Run analysis first, then select the independent Kaggle results file.';
 const target=$('mapgrid');target.replaceChildren();
 for(const key of [...required,'status']){
  const label=make('label','',titles[key]),select=make('select');
  for(const heading of ['',...parsed.headers]){
   const opt=make('option','',heading||'Not mapped');opt.value=heading;
   if(mapping[key]===heading)opt.selected=true;
   select.append(opt);
  }
  select.setAttribute('aria-label',titles[key]);
  select.addEventListener('change',()=>{mapping[key]=select.value});
  label.append(select);target.append(label);
 }
 extraLabs.onDataChanged(dataset);
}
$('file').addEventListener('change',async event=>{
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{
  if(file.size>15*1024*1024)throw Error('CSV exceeds the 15 MB pilot limit.');
  await loadCSV(await file.text(),file.name);
 }catch(error){alert('Could not load CSV: '+error.message)}
});
$('weight').addEventListener('input',()=>{$('weightOut').textContent=$('weight').value+'%'});
function syntheticCSV(){
 const rows=['unique_key,created_date,closed_date,agency,complaint_type,borough,status,public_summary,synthetic_wait_days,synthetic_priority_score'];
 let id=0;
 const regions=['BRONX','BROOKLYN','MANHATTAN','QUEENS','STATEN ISLAND'];
 const baselines={BRONX:5,BROOKLYN:8,MANHATTAN:2,QUEENS:15,'STATEN ISLAND':24};
 for(const service of DEFAULTS.services)for(const region of regions)for(let k=0;k<24;k++){
  id++;
  const created=new Date(Date.UTC(2025,0,2+(k*3+id)%80,id%12));
  const days=Math.max(0,baselines[region]+(service==='Graffiti'?6:0)+(k%7)*3-7);
  const closed=(k+id)%13===0?'':new Date(created.getTime()+(days*24+k%6)*3600000).toISOString().slice(0,19);
  const summaries=['Request reported with delayed response and no feedback','Collection service complaint with missed pickup','Graffiti report awaiting agency update','Public complaint resolved following acknowledgement'];
  const values=['SYN-'+String(id).padStart(5,'0'),created.toISOString().slice(0,19),closed,'DSNY',service,region,closed?'Closed':'Open',summaries[(k+id)%summaries.length],String(days),String((k%5)+1)];
  rows.push(values.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','));
 }
 return rows.join('\n');
}
$('demo').addEventListener('click',async()=>{try{await loadCSV(syntheticCSV(),syntheticLabel)}catch(e){alert(e.message)}});
$('analyze').addEventListener('click',()=>{
 if(!dataset)return;
 try{
  const config={from:$('from').value,to:$('to').value,snapshot:$('snapshot').value,horizonDays:Number($('horizon').value),minN:Number($('minN').value),wFriction:Number($('weight').value)/100};
  report=analyze(dataset.data,mapping,config);prediction=null;cpuResult=null;
  report.source={filename,sha256:sha,parsedRows:dataset.data.length,malformedCSVRows:dataset.malformed,synthetic:filename.startsWith('SYNTHETIC')};
  extraLabs.onOutputsChanged();
  showReport();$('results').hidden=false;$('cpu').hidden=false;$('cpuoutput').hidden=true;$('cpustatus').textContent='Ready to run CPU analysis locally. No records will be uploaded.';$('predict').hidden=false;$('predictresults').hidden=true;$('predictcomparison').textContent='Run prediction before importing independent model metrics.';$('predictmessage').textContent='Ready for leakage-safe temporal evaluation. The held-out test period is never used for training.';$('results').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){alert('Analysis stopped: '+error.message)}
});
function showReport(){
 const counts=report.counts,groups=report.groups,scored=groups.filter(g=>g.score!==null);
 $('resultstate').className='sourceflag'+(report.source.synthetic?'':' real');
 $('resultstate').textContent=report.source.synthetic?'SYNTHETIC TRAINING DATA — these are fabricated example records.':'USER-UPLOADED DATA — verify source, coverage and representativeness before making empirical claims.';
 const kpis=$('kpis');kpis.replaceChildren();
 for(const [value,label] of [[int(counts.eligible),'Eligible requests'],[int(scored.length),'Scorable service–borough groups'],[scored.length?dec(scored.reduce((a,g)=>a+g.score,0)/scored.length):'—','Mean score across groups (unweighted)']]){
  const card=make('div','kpi');card.append(make('strong','',value),make('span','',label));kpis.append(card);
 }
 const audit=$('audit');audit.replaceChildren();
 for(const [field,n] of Object.entries(counts)){
  const item=make('div');item.append(make('b','',int(n)),make('span','',field.replace(/([A-Z])/g,' $1')));audit.append(item);
 }
 const filter=$('filterService'),previous=filter.value;
 filter.replaceChildren();const all=make('option','','All services');all.value='all';filter.append(all);
 for(const service of [...new Set(groups.map(g=>g.service))].sort()){
  const o=make('option','',service);o.value=service;filter.append(o);
 }
 filter.value=[...filter.options].some(o=>o.value===previous)?previous:'all';
 redrawGroupViews();
 $('compareout').textContent='Ready for independent Kaggle comparison. Both source SHA-256 checksums must be identical.';
}
function redrawGroupViews(){
 if(!report)return;
 const selected=$('filterService').value;
 const groups=report.groups.filter(g=>selected==='all'||g.service===selected);
 const table=$('tablebody');table.replaceChildren();
 for(const g of groups){
  const tr=make('tr');
  for(const val of [g.service+' / '+g.borough,int(g.n),pct(g.nonclosure30),pct(g.delayBurden30),pct(g.asymmetry),dec(g.score)])tr.append(make('td','',val));
  tr.title=g.warning||('Wilson 95% interval for nonclosure: '+pct(g.wilsonLow)+'–'+pct(g.wilsonHigh));
  table.append(tr);
 }
 const chart=$('bars');chart.replaceChildren();
 const scored=groups.filter(g=>g.score!==null).sort((a,b)=>b.score-a.score);
 if(!scored.length){chart.append(make('p','sub','No comparable groups meet the current minimum size.'));return}
 for(const g of scored.slice(0,15)){
  const row=make('div','baritem');
  const label=make('div','',g.service.replace('Missed Collection (All Materials)','Missed collection')+' · '+g.borough);
  const track=make('div','barline'),bar=make('div','barfill');
  bar.style.width=Math.max(0,Math.min(g.score,100))+'%';bar.setAttribute('aria-label','BFS-DAI '+dec(g.score));
  track.append(bar);row.append(label,track,make('strong','',dec(g.score)));chart.append(row);
 }
}
$('filterService').addEventListener('change',redrawGroupViews);
function download(data,name,mime){
 const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$('reportjson').addEventListener('click',()=>{
 if(report)download(JSON.stringify(report,null,2),'govfriction-research-record.json','application/json');
});
$('resultcsv').addEventListener('click',()=>{
 if(!report)return;
 const rows=report.groups.map(g=>({...g,source_sha256:sha||'',protocol:report.protocol}));
 download(exportCSV(rows),'govfriction-app-results.csv','text/csv;charset=utf-8');
});
$('comparefile').addEventListener('change',async event=>{
 if(!report){$('compareout').textContent='Run analysis before comparing.';return}
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{
  if(file.size>15*1024*1024)throw Error('Comparison file exceeds 15 MB.');
  const ref=parseCSV(await file.text()).data;
  const comparison=compareReports(report.groups,ref,sha,ref[0]?.source_sha256);
  $('compareout').textContent=(comparison.ok?'PASS':'REVIEW NEEDED')+' — '+comparison.reason+
   (comparison.rows.length?'\n'+comparison.rows.map(g=>g.service+' / '+g.borough+': '+g.result).join('\n'):'');
 }catch(error){$('compareout').textContent='Comparison stopped: '+error.message}
});

function showPrediction(){
 const models=prediction.models,split=prediction.split;
 $('predictwindow').textContent='Training: '+split.trainStart+' to '+split.trainEndExclusive+' (exclusive) · Excluded follow-up gap until '+split.holdoutStart+' · Testing: '+split.holdoutStart+' to '+split.holdoutEndExclusive+' (exclusive) · Training cases: '+int(split.trainingN)+' · Test cases: '+int(split.holdoutN)+' · Test nonclosure rate: '+pct(split.holdoutEventRate)+'.';
 const table=$('predictmetrics');table.replaceChildren();
 for(const model of models){
  const m=model.metrics,tr=make('tr');
  for(const field of [model.name,pct(m.accuracy),pct(m.balancedAccuracy),pct(m.recall),pct(m.precision),dec(m.rocAuc),m.brier.toFixed(4),m.logLoss.toFixed(4)])tr.append(make('td','',field));
  table.append(tr);
 }
 const calibration=$('predictcalibration');calibration.replaceChildren();
 for(const model of models){
  const block=make('div','calibrationcard');block.append(make('strong','',model.name));
  for(const row of model.metrics.calibration){
   const item=make('div','calibrationline');
   const label=make('span','',(row.lower*100).toFixed(0)+'–'+(row.upper*100).toFixed(0)+'% · '+int(row.n)+' requests');
   const summary=make('span','',row.n?'Forecast '+pct(row.probability)+' / observed '+pct(row.observed):'No test cases in this interval');
   item.append(label,summary);block.append(item);
  }
  calibration.append(block);
 }
 const coef=$('predictcoefs');coef.replaceChildren();
 for(const row of (models.find(m=>m.coefficients)?.coefficients||[])){
  const tr=make('tr');tr.append(make('td','',row.name),make('td','',dec(row.beta)),make('td','',dec(row.oddsRatio)));coef.append(tr);
 }
 $('predictresults').hidden=false;
}
$('runprediction').addEventListener('click',async()=>{
 if(!dataset||!report){$('predictmessage').textContent='First import a dataset and complete the audited analysis.';return}
 $('runprediction').disabled=true;$('predictmessage').textContent='Fitting and testing statistical models locally…';
 try{
  prediction=await runBrowserJob('prediction',dataset.data,mapping,report.config);
  if(prediction.audit.eligible!==report.counts.eligible)throw Error('Predictive audit differs from descriptive audit; the evaluation has been stopped.');
  prediction.source={filename:report.source.filename,sha256:report.source.sha256,synthetic:report.source.synthetic};
  showPrediction();
  $('predictmessage').textContent=(report.source.synthetic?'SYNTHETIC training example only. ':'User-uploaded data; verify provenance. ')+'Three models evaluated on a strictly later time window.';
 }catch(error){
  prediction=null;$('predictresults').hidden=true;
  $('predictmessage').textContent='Evaluation withheld: '+error.message;
 }finally{$('runprediction').disabled=false}
});
$('downloadprediction').addEventListener('click',()=>{
 if(prediction)download(JSON.stringify(prediction,null,2),'govfriction-prediction-evaluation.json','application/json');
});


$('predictreference').addEventListener('change',async event=>{
 if(!prediction||!sha){$('predictcomparison').textContent='Run the app prediction on the same frozen source CSV first.';return}
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('Prediction reference file exceeds 5 MB.');
  const reference=parseCSV(await file.text()).data;
  if(reference.length!==prediction.models.length)throw Error('Expected exactly three independent model rows.');
  const names=new Set(),lines=['Independent prediction evaluation (same dataset and time window):'];
  for(const row of reference){
   if(!row.source_sha256||row.source_sha256.toLowerCase()!==sha.toLowerCase())throw Error('Dataset SHA-256 mismatch: comparison refused.');
   if(row.train_end_exclusive!==prediction.split.trainEndExclusive||
      row.holdout_start!==prediction.split.holdoutStart||
      Number(row.training_n)!==prediction.split.trainingN||
      Number(row.holdout_n)!==prediction.split.holdoutN)throw Error('Training/holdout split or row counts disagree: comparison refused.');
   if(names.has(row.model))throw Error('Duplicate independent model name: '+row.model);
   names.add(row.model);
   const own=prediction.models.find(m=>m.name===row.model);
   if(!own)throw Error('Unrecognised independent model: '+row.model);
   const diffs=[];
   for(const field of [['accuracy','accuracy'],['roc_auc','rocAuc'],['brier','brier'],['log_loss','logLoss']]){
    const ref=Number(row[field[0]]),local=own.metrics[field[1]];
    if(!Number.isFinite(ref)||!Number.isFinite(local))throw Error('Invalid independent performance value: '+field[0]);
    diffs.push(field[0]+': app '+local.toFixed(4)+', Kaggle '+ref.toFixed(4)+', difference '+Math.abs(local-ref).toFixed(4));
   }
   lines.push('\n'+row.model+'\n  '+diffs.join('\n  '));
  }
  lines.push('\nCheck any differences against estimation method, priors and numerical convergence. Similar metrics support reproducibility; they do not establish substantive validity.');
  $('predictcomparison').textContent=lines.join('\n');
 }catch(error){$('predictcomparison').textContent='Independent prediction comparison withheld: '+error.message}
});


async function checkBackend(){
 try{
  const response=await fetch('/api/health',{cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))throw Error('Not a Worker API');
  const status=await response.json();
  if(status.runtime!=='cloudflare-worker')throw Error('No Worker runtime');
  backendReady=status.serverAggregateAnalysis===true;
  $('backendstatus').textContent='Cloudflare Worker connected · API running · environment variables enabled · server aggregate analysis '+(backendReady?'available':'disabled');
  $('backendstatus').className='backendstatus connected';
 }catch{
  backendReady=false;
  $('backendstatus').className='backendstatus disconnected';
  $('backendstatus').textContent='Static-only deployment or Worker API currently unavailable. Browser data analysis still works; Cloudflare variables require the Worker deployment.';
 }
 $('cpuserver').disabled=!backendReady||!$('cpuconsent').checked||!cpuResult;
}
checkBackend();

function runBrowserJob(type,rows,columnMapping,config){
 if(typeof Worker==='undefined')return Promise.reject(Error('Your browser does not support CPU Workers. Try a modern desktop browser.'));
 return new Promise((resolve,reject)=>{
  const worker=new Worker('./cpu-worker.mjs',{type:'module'});
  const jobId='job-'+Math.random().toString(36).slice(2);
  const timeout=setTimeout(()=>finish(Error('Analysis exceeded the 90-second browser CPU limit. Try a smaller frozen cohort.')),90000);
  let ended=false;
  function finish(error,result){
   if(ended)return;ended=true;clearTimeout(timeout);worker.terminate();
   error?reject(error):resolve(result);
  }
  worker.onmessage=event=>{
   const data=event.data||{};
   if(data.jobId!==jobId)return;
   data.ok?finish(null,data.result):finish(Error(data.error||'CPU job failed.'));
  };
  worker.onerror=()=>finish(Error('Browser CPU Worker could not load or execute.'));
  worker.postMessage({type,rows,mapping:columnMapping,config,jobId});
 });
}
function showCPU(){
 const selected=$('cpuservice'),previous=selected.value;
 selected.replaceChildren();
 for(const service of cpuResult.aggregateByService){
  const option=make('option','',service.service);option.value=service.service;selected.append(option);
 }
 if([...selected.options].some(x=>x.value===previous))selected.value=previous;
 const monthly=$('cputrends');monthly.replaceChildren();
 for(const r of cpuResult.trends){
  const tr=make('tr');
  for(const val of [r.month,r.service,int(r.n),pct(r.rate),pct(r.wilson95Low)+'–'+pct(r.wilson95High)])tr.append(make('td','',val));
  monthly.append(tr);
 }
 const curves=$('cpusurvival');curves.replaceChildren();
 for(const c of cpuResult.survival){
  const panel=make('div','survivalpanel');
  panel.append(make('strong','',c.service+' · n='+int(c.n)+' · median time-to-closure: '+(c.medianClosedDays===null?'not reached':c.medianClosedDays.toFixed(1)+' days')));
  const table=make('table'),head=make('thead'),row=make('tr');
  for(const v of ['Follow-up day','Still not recorded closed','95% approximate interval'])row.append(make('th','',v));
  head.append(row);table.append(head);
  const tbody=make('tbody');
  for(const v of c.byDay){
   const tr=make('tr');
   for(const val of [v.day,pct(v.remaining),pct(v.lower95)+'–'+pct(v.upper95)])tr.append(make('td','',val));
   tbody.append(tr);
  }
  table.append(tbody);panel.append(table);curves.append(panel);
 }
 drawCpuGroups();
 $('cpucompareout').textContent='Choose the Kaggle advanced_cpu_kaggle_groups.csv file for independent verification.';
 $('cpuoutput').hidden=false;
}
function drawCpuGroups(){
 if(!cpuResult)return;
 const service=$('cpuservice').value, tbody=$('cpugroups');tbody.replaceChildren();
 for(const g of cpuResult.groups.filter(x=>x.service===service)){
  const row=make('tr');
  for(const val of [g.name,int(g.n),int(g.nonclosed),pct(g.rate),pct(g.wilson95Low)+'–'+pct(g.wilson95High)])row.append(make('td','',val));
  row.title=g.n<30?'Small sample: interval and group rate are exploratory.':'Wilson 95% interval';
  tbody.append(row);
 }
 $('cpuconsent').checked=false;
 $('cpuserver').disabled=true;
 $('cpuserverresult').textContent='Server aggregate test has not run for this service.';
}
$('cpuservice').addEventListener('change',drawCpuGroups);
$('cpuconsent').addEventListener('change',()=>{$('cpuserver').disabled=!backendReady||!$('cpuconsent').checked||!cpuResult});
$('runcpu').addEventListener('click',async()=>{
 if(!dataset||!report){$('cpustatus').textContent='Import data and run the audited index analysis first.';return}
 $('runcpu').disabled=true;$('cpustatus').textContent='Running analytical CPU thread: stratified rates, Wilson intervals, trends, survival curves…';
 try{
  cpuResult=await runBrowserJob('research',dataset.data,mapping,report.config);
  if(cpuResult.audit.eligible!==report.counts.eligible)throw Error('Research CPU group audit differs from the BFS-DAI record count. Report withheld.');
  cpuResult.source={filename,sha256:sha,synthetic:report.source.synthetic};
  showCPU();
  extraLabs.onOutputsChanged();
  $('cpustatus').textContent='Completed locally on '+int(cpuResult.eligible)+' eligible requests'+(report.source.synthetic?' · SYNTHETIC demonstration only.':'.');
 }catch(error){cpuResult=null;$('cpuoutput').hidden=true;$('cpustatus').textContent='CPU analysis stopped: '+error.message}
 finally{$('runcpu').disabled=false}
});
$('cpudownload').addEventListener('click',()=>{
 if(cpuResult)download(JSON.stringify(cpuResult,null,2),'govfriction-cpu-research-report.json','application/json');
});
$('cpuserver').addEventListener('click',async()=>{
 if(!cpuResult||!backendReady||!$('cpuconsent').checked)return;
 const match=cpuResult.aggregateByService.find(s=>s.service===$('cpuservice').value);
 if(!match){$('cpuserverresult').textContent='No comparable groups.';return}
 $('cpuserver').disabled=true;$('cpuserverresult').textContent='Sending selected service aggregate counts to Cloudflare Worker for statistical testing…';
 try{
  const response=await fetch('/api/analysis/contingency',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({groups:match.groups})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Worker API returned '+response.status);
  $('cpuserverresult').textContent='Cloudflare Worker calculated Pearson χ² = '+dec(data.chiSquare)+
    ' · df = '+int(data.degreesOfFreedom)+' · p-value = '+(data.pValue===null?'withheld (small expected counts)':data.pValue.toPrecision(4))+
    ' · Cramér V = '+dec(data.cramersV)+
    '\nRecords (aggregated only): '+int(data.total)+'\n'+data.notes.join(' ');
 }catch(error){$('cpuserverresult').textContent='Server aggregate calculation failed: '+error.message}
 finally{$('cpuserver').disabled=!$('cpuconsent').checked||!backendReady}
});


$('cpucompare').addEventListener('change',async event=>{
 if(!cpuResult||!sha){$('cpucompareout').textContent='Run local CPU research analysis first.';return}
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('Kaggle reference CSV exceeds 5 MB.');
  const parsed=parseCSV(await file.text());
  if(parsed.malformed>0)throw Error('Malformed rows found in independent CSV.');
  const reference=parsed.data;
  if(reference.length!==cpuResult.groups.length)throw Error('Group coverage mismatch: app '+cpuResult.groups.length+' vs Kaggle '+reference.length);
  const table=new Map();
  for(const row of reference){
   if(row.source_sha256!==sha)throw Error('Frozen source SHA-256 differs; cannot compare separate dataset versions.');
   const key=row.service+'\u001f'+row.borough;
   if(table.has(key))throw Error('Duplicate independent group: '+key.replace('\u001f',' / '));
   table.set(key,row);
  }
  const failures=[];
  for(const g of cpuResult.groups){
   const key=g.service+'\u001f'+g.name,ref=table.get(key);
   if(!ref){failures.push(g.service+' / '+g.name+': missing');continue}
   if(Number(ref.n)!==g.n||Number(ref.nonclosed)!==g.nonclosed||
      ['rate','wilson95Low','wilson95High'].some(name=>!Number.isFinite(Number(ref[name]))||Math.abs(Number(ref[name])-g[name])>1e-9))
     failures.push(g.service+' / '+g.name+': numerical difference');
   table.delete(key);
  }
  if(table.size)failures.push('Extra independent groups: '+table.size);
  $('cpucompareout').textContent=failures.length?'REVIEW NEEDED · '+failures.length+' disagreement(s):\n'+failures.join('\n')
    :'PASS: all '+cpuResult.groups.length+' groups match Kaggle counts, rates, confidence intervals and source SHA-256. Numerical agreement does not prove conceptual validity.';
 }catch(error){$('cpucompareout').textContent='Comparison stopped: '+error.message}
});

const extraLabs=initResearchLabs({
 getOutputs:()=>({report,cpu:cpuResult,prediction}),
 runJob:runBrowserJob,
 onMutation:(change)=>{
  report=null;prediction=null;cpuResult=null;sha=null;
  for(const id of ['results','cpu','predict'])$(id).hidden=true;
  $('compareout').textContent='Data transformed: import the exported revised CSV as a new frozen source before Kaggle validation.';
  $('filemeta').textContent=filename+' · modified in browser with derived variable '+change.name+
    ' · source checksum invalidated; download and re-import the modified CSV before independent comparison.';
  extraLabs.onDataChanged(dataset);
 }
});
