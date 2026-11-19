/* Reusable SVG research chart engine: deterministic, interactive controls live in UI. */
const SVG='http://www.w3.org/2000/svg';
export const CHART_PROTOCOL='govfriction-visuals-v0.1';
export function modelChart(rows,{type='bar',x='',y='',max=20}={}){
 if(!Array.isArray(rows)||!rows.length)throw Error('Run an analysis or load a dataset before charting.');
 if(!['bar','line','scatter','histogram'].includes(type))throw Error('Unsupported chart type.');
 if(!Number.isInteger(max)||max<3||max>100)throw Error('Set max chart items between 3 and 100.');
 if(!Object.hasOwn(rows[0],x))throw Error('Select a chart X variable.');
 const validNumber=value=>{
  const s=String(value??'').trim();
  if(!s||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
 };
 let points=[];
 if(type==='histogram'){
  const nums=rows.map(row=>validNumber(row[x])).filter(v=>v!==null);
  if(!nums.length)throw Error('Histogram needs a numerical X variable.');
  const min=Math.min(...nums),maximum=Math.max(...nums);
  if(min===maximum)throw Error('Histogram requires numeric variation.');
  const bins=Math.min(16,Math.max(4,Math.ceil(Math.sqrt(nums.length))));
  const width=(maximum-min)/bins,counts=Array(bins).fill(0);
  for(const n of nums)counts[Math.min(bins-1,Math.floor((n-min)/width))]++;
  points=counts.map((n,i)=>({label:(min+i*width).toPrecision(3),value:n}));
 }else if(type==='bar'||type==='line'){
  const map=new Map();
  const useY=Boolean(y);
  if(useY&&!Object.hasOwn(rows[0],y))throw Error('Select an existing Y variable.');
  for(const row of rows){
   const key=String(row[x]??'').trim();if(!key)continue;
   const n=useY?validNumber(row[y]):1;
   if(n===null)continue;
   const z=map.get(key)||{sum:0,count:0};z.sum+=n;z.count++;map.set(key,z);
  }
  points=[...map].map(([label,z])=>({label,value:useY?z.sum/z.count:z.count,n:z.count}));
  if(type==='bar')points.sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
  else points.sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  points=points.slice(0,max);
 }else{
  if(!y||!Object.hasOwn(rows[0],y))throw Error('Scatter plots require two numerical variables.');
  for(const row of rows){
   const xv=validNumber(row[x]),yv=validNumber(row[y]);
   if(xv!==null&&yv!==null)points.push({x:xv,y:yv});
  }
  if(points.length>2000)throw Error('Scatter limit is 2,000 points; use a declared sampling protocol.');
  if(points.length<2)throw Error('Scatter requires two complete numerical pairs.');
 }
 if(!points.length)throw Error('No valid chart points after excluding missing values.');
 return {protocol:CHART_PROTOCOL,type,x,y,points,analysed:rows.length,
  notes:'SVG uses text nodes, not HTML. Series aggregation is count or mean(Y) by category; exploratory only.'};
}
function node(tag,attrs={},text=null){
 const el=document.createElementNS(SVG,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 if(text!==null)el.textContent=String(text);
 return el;
}
export function drawChart(container,model,{title='Research visualization'}={}){
 if(typeof document==='undefined')throw Error('SVG rendering requires a browser DOM.');
 const width=900,height=460,left=76,right=25,top=65,bottom=105,W=width-left-right,H=height-top-bottom;
 const svg=node('svg',{xmlns:SVG,viewBox:'0 0 '+width+' '+height,role:'img','aria-label':title,style:'max-width:100%;height:auto;display:block'});
 svg.append(node('rect',{width,height,fill:'#ffffff'}),node('text',{x:40,y:32,fill:'#143c35','font-size':20,'font-weight':700},title));
 const grid=5;
 const series=model.points;
 const vals=model.type==='scatter'?series.map(p=>p.y):series.map(p=>p.value);
 const rawMin=Math.min(0,...vals),rawMax=Math.max(0,...vals);
 const min=model.type==='scatter'?Math.min(...vals):rawMin, max=rawMax===min?min+1:rawMax;
 const scaleY=v=>top+H-(v-min)/(max-min)*H;
 for(let i=0;i<=grid;i++){
  const v=min+(max-min)*i/grid,y=scaleY(v);
  svg.append(node('line',{x1:left,y1:y,x2:width-right,y2:y,stroke:'#e4eee8','stroke-width':1}));
  svg.append(node('text',{x:left-10,y:y+4,fill:'#60786d','font-size':12,'text-anchor':'end'},Number(v.toPrecision(3))));
 }
 if(model.type==='scatter'){
  const xmin=Math.min(...series.map(p=>p.x)),xmax=Math.max(...series.map(p=>p.x)),span=(xmax-xmin)||1;
  for(const p of series)svg.append(node('circle',{cx:left+(p.x-xmin)/span*W,cy:scaleY(p.y),r:4,fill:'#177f67','fill-opacity':.65}));
  svg.append(node('text',{x:left,y:height-42,'font-size':12,fill:'#576c63'},Number(xmin.toPrecision(4))));
  svg.append(node('text',{x:width-right,y:height-42,'font-size':12,fill:'#576c63','text-anchor':'end'},Number(xmax.toPrecision(4))));
 }else{
  const step=W/series.length,bw=Math.max(3,Math.min(38,step*.65));
  if(model.type==='line'){
   const pts=series.map((p,i)=>(left+(i+.5)*step)+','+scaleY(p.value)).join(' ');
   svg.append(node('polyline',{points:pts,fill:'none',stroke:'#177f67','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
   for(let i=0;i<series.length;i++)svg.append(node('circle',{cx:left+(i+.5)*step,cy:scaleY(series[i].value),r:3.5,fill:'#177f67'}));
  }else for(let i=0;i<series.length;i++){
   const p=series[i],y=scaleY(Math.max(0,p.value)),base=scaleY(0);
   svg.append(node('rect',{x:left+(i+.5)*step-bw/2,y:Math.min(y,base),width:bw,height:Math.max(1,Math.abs(base-y)),rx:3,fill:'#1c8068'}));
  }
  const every=Math.max(1,Math.ceil(series.length/12));
  for(let i=0;i<series.length;i+=every){
   const text=String(series[i].label).slice(0,19);
   svg.append(node('text',{x:left+(i+.5)*step,y:height-47,transform:'rotate(-35 '+(left+(i+.5)*step)+' '+(height-47)+')','font-size':11,'text-anchor':'end',fill:'#51695f'},text));
  }
 }
 svg.append(node('text',{x:left+W/2,y:height-13,fill:'#315f50','font-size':13,'text-anchor':'middle'},model.x||'Category'));
 const yName=model.type==='histogram'?'Count':model.type==='bar'&&!model.y?'Count':model.y||'Value';
 svg.append(node('text',{x:18,y:top+H/2,transform:'rotate(-90 18 '+(top+H/2)+')',fill:'#315f50','font-size':13,'text-anchor':'middle'},yName));
 container.replaceChildren(svg);
 return svg;
}
export function serializeSVG(svg){
 if(!svg||svg.namespaceURI!==SVG)throw Error('Render a chart before exporting.');
 return new XMLSerializer().serializeToString(svg);
}
