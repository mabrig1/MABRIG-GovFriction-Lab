import {profile,derive,buildR} from './r-statistics.mjs';
import {analyzeContent} from './content-analysis.mjs';
import {modelChart,drawChart,serializeSVG} from './visualization.mjs';
import {exportCSV} from './engine.mjs';

const WEBR_URL='https://webr.r-wasm.org/v0.6.1/';
const $=id=>document.getElementById(id);
const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n};
const safeFile=(value,name,type)=>{
 const blob=new Blob([value],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
};
function options(select,names,optional=false){
 const previous=select.value;select.replaceChildren();
 if(optional){const option=node('option','Not selected');option.value='';select.append(option)}
 for(const name of names){const item=node('option',name);item.value=name;select.append(item)}
 if([...select.options].some(o=>o.value===previous))select.value=previous;
}
function message(error){return String(error?.message||error)}
export function initResearchLabs({getOutputs,onMutation,runJob}){
 let dataset=null,contentResult=null,chartResult=null,chartSVG=null,rPromise=null,rStudy=null;
 function chartRows(){
  const source=$('vizsource').value,outputs=getOutputs();
  if(source==='dataset')return dataset?.data||[];
  if(source==='content')return contentResult?.frequentTerms||[];
  if(source==='cpu')return outputs.cpu?.trends||[];
  if(source==='bfs')return outputs.report?.groups||[];
  return [];
 }
 function updateViz(){
  const rows=chartRows(),keys=rows.length?Object.keys(rows[0]):[];
  options($('vizx'),keys);
  options($('vizy'),keys,true);
  const guesses={dataset:'borough',content:'term',cpu:'month',bfs:'borough'};
  const preferred=guesses[$('vizsource').value];
  if(keys.includes(preferred))$('vizx').value=preferred;
  $('vizsvg').disabled=true;$('vizcsv').disabled=true;
  chartResult=null;chartSVG=null;$('vizcanvas').replaceChildren();
 }
 function setup(data){
  dataset=data;contentResult=null;rStudy=null;chartResult=null;chartSVG=null;
  for(const id of ['rlab','contentlab','vizlab'])$(id).hidden=!data;
  $('routput').textContent='R results will appear here.';
  $('rstatus').textContent='Select a statistical model. R downloads on first execution only.';
  $('textresults').hidden=true;$('textstatus').textContent='Ready. This analysis is transparent lexical counting, not AI interpretation.';
  $('rcreatemessage').textContent='';
  $('rsummary').textContent=data?data.data.length.toLocaleString()+' records · '+data.headers.length+' variables':'';
  refreshVariables();
  updateViz();
 }
 function refreshVariables(){
  if(!dataset)return;
  const dictionary=profile(dataset.data,dataset.headers),body=$('rvars');body.replaceChildren();
  for(const d of dictionary){
   const row=node('tr');
   for(const value of [d.name,d.kind+(d.mixed?' (mixed values)':''),d.valid,d.missing,d.levels])
    row.append(node('td',value));
   body.append(row);
  }
  const cols=dataset.headers;
  for(const id of ['rleft','rright','rx','ry','rgroup','textcolumn']){
   const optional=id==='ry'||id==='rgroup';options($(id),cols,optional);
  }
  const constant=node('option','Numeric constant');constant.value='__constant__';$('rright').prepend(constant);
  if(cols.includes('public_summary'))$('textcolumn').value='public_summary';
  else if(cols.includes('resolution_description'))$('textcolumn').value='resolution_description';
  else if(cols.includes('descriptor'))$('textcolumn').value='descriptor';
  $('rsummary').textContent=dataset.data.length.toLocaleString()+' records · '+cols.length+' variables';
 }
 $('rcreate').addEventListener('click',()=>{
  if(!dataset)return;
  try{
   const result=derive(dataset.data,{name:$('rnewname').value.trim(),left:$('rleft').value,
     op:$('roperator').value,right:$('rright').value,constant:$('rconstant').value});
   dataset.data=result.data;dataset.headers=[...dataset.headers,result.name];
   onMutation(result);
   refreshVariables();updateViz();
   $('rcreatemessage').textContent='Created '+result.name+'; '+result.missing+' missing results; '+result.zero+
     ' divisions by zero. The original CSV hash is invalidated; download the edited CSV before independent comparison.';
  }catch(error){$('rcreatemessage').textContent='Not added: '+message(error)}
 });
 $('rexportdata').addEventListener('click',()=>{
  if(!dataset)return;
  safeFile(exportCSV(dataset.data),'govfriction-derived-data.csv','text/csv;charset=utf-8');
 });
 function getRStudy(){
  if(!dataset)throw Error('Load a dataset first.');
  return buildR(dataset.data,{test:$('rmethod').value,x:$('rx').value,y:$('ry').value,group:$('rgroup').value});
 }
 $('rscript').addEventListener('click',()=>{
  try{
   rStudy=getRStudy();
   safeFile(rStudy.script+'\n','govfriction-base-r-analysis.R','text/plain;charset=utf-8');
   $('rstatus').textContent='Downloaded R script with embedded selected column values. Treat this download as potentially sensitive and store it securely.';
  }catch(error){$('rstatus').textContent='R export stopped: '+message(error)}
 });
 async function loadR(){
  if(!rPromise)rPromise=(async()=>{
   const module=await import(WEBR_URL+'webr.mjs');
   const instance=new module.WebR({baseUrl:WEBR_URL});
   await instance.init();return instance;
  })().catch(error=>{rPromise=null;throw error});
  return rPromise;
 }
 $('rrun').addEventListener('click',async()=>{
  $('rrun').disabled=true;
  try{
   rStudy=getRStudy();
   $('rstatus').textContent='Loading R WebAssembly on first use; computations remain inside this browser…';
   const r=await loadR();
   $('rstatus').textContent='Running base R on '+rStudy.complete+' complete cases…';
   $('routput').textContent=await r.evalRString(rStudy.expression);
   $('rstatus').textContent='Executed in browser webR. Source rows were not submitted to GovFriction Lab server.';
  }catch(error){
   $('routput').textContent='No R result generated.';
   $('rstatus').textContent='R execution failed: '+message(error)+'. You can still download the script for desktop R.';
  }finally{$('rrun').disabled=false}
 });
 function tableRows(id,rows,keys){
  const body=$(id);body.replaceChildren();
  if(!rows.length){const tr=node('tr'),td=node('td','No results for this section');td.colSpan=keys.length;tr.append(td);body.append(tr);return}
  for(const data of rows){
   const tr=node('tr');for(const key of keys){
    const value=data[key],formatted=typeof value==='number'&&!Number.isInteger(value)?value.toFixed(4):value;
    tr.append(node('td',formatted??'—'));
   }
   body.append(tr);
  }
 }
 $('textanalyze').addEventListener('click',async()=>{
  if(!dataset)return;
  $('textanalyze').disabled=true;$('textstatus').textContent='Computing themes, word frequencies, bigrams and TF-IDF locally…';
  try{
   const settings={column:$('textcolumn').value,themes:$('textthemes').value,
    minTermLength:Number($('textmin').value),top:Number($('texttop').value)};
   contentResult=await runJob('content',dataset.data,{},settings);
   const kpis=$('textkpis');kpis.replaceChildren();
   for(const [label,value] of [['Documents',contentResult.documents],['Usable texts',contentResult.nonempty],['Distinct words',contentResult.distinctTerms]]){
    const panel=node('div','','kpi');panel.append(node('strong',value),node('span',label));kpis.append(panel);
   }
   tableRows('textterms',contentResult.frequentTerms,['term','count']);
   tableRows('texttfidf',contentResult.tfidf,['term','score','documentFrequency']);
   tableRows('textbigrams',contentResult.bigrams,['term','count']);
   tableRows('textthemesoutput',contentResult.themes,['name','documents','hits','documentPercent']);
   $('textresults').hidden=false;
   $('textstatus').textContent='Completed locally. '+contentResult.missing+' empty documents excluded. Theme matches are lexical counts.';
   if($('vizsource').value==='content')updateViz();
  }catch(error){contentResult=null;$('textresults').hidden=true;$('textstatus').textContent='Content analysis stopped: '+message(error)}
  finally{$('textanalyze').disabled=false}
 });
 $('textexport').addEventListener('click',()=>{
  if(contentResult)safeFile(JSON.stringify(contentResult,null,2),'govfriction-content-analysis.json','application/json');
 });
 $('vizsource').addEventListener('change',updateViz);
 $('vizdraw').addEventListener('click',()=>{
  try{
   const rows=chartRows(),settings={type:$('viztype').value,x:$('vizx').value,
    y:$('vizy').value,max:Number($('vizmax').value)};
   chartResult=modelChart(rows,settings);
   chartSVG=drawChart($('vizcanvas'),chartResult,{title:'GovFriction Lab · '+$('vizsource').selectedOptions[0].textContent});
   $('vizsvg').disabled=false;$('vizcsv').disabled=false;
   $('vizstatus').textContent='Rendered '+chartResult.points.length+' plotted values locally. Download SVG or the exact plotted series.';
  }catch(error){chartResult=null;chartSVG=null;$('vizsvg').disabled=true;$('vizcsv').disabled=true;$('vizstatus').textContent='Visualization stopped: '+message(error)}
 });
 $('vizsvg').addEventListener('click',()=>{
  if(chartSVG)safeFile(serializeSVG(chartSVG),'govfriction-research-chart.svg','image/svg+xml;charset=utf-8');
 });
 $('vizcsv').addEventListener('click',()=>{
  if(chartResult)safeFile(exportCSV(chartResult.points),'govfriction-chart-data.csv','text/csv;charset=utf-8');
 });
 return {onDataChanged:setup,onOutputsChanged:updateViz};
}
