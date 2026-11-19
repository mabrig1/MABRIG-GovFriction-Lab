/**
 * Independent lightweight contingency statistics for Cloudflare Workers and Node.
 * All inputs are aggregated 2-outcome counts; no person-level rows are accepted.
 */
const wilson=(events,n)=>{
 if(!n)return [null,null];
 const z=1.959963984540054,den=1+z*z/n,p=events/n;
 const mid=(p+z*z/(2*n))/den;
 const half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
 return [Math.max(0,mid-half),Math.min(1,mid+half)];
};
function logGamma(z){
 const c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.6150291621406,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
 if(z<0.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
 z-=1;
 let x=c[0];
 for(let i=1;i<c.length;i++)x+=c[i]/(z+i);
 const t=z+7.5;
 return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
function upperGammaQ(a,x){
 if(x<0||a<=0)throw Error("Invalid gamma parameters");
 if(x===0)return 1;
 const gln=logGamma(a);
 if(x<a+1){
  let term=1/a,sum=term;
  for(let k=1;k<1000;k++){term*=x/(a+k);sum+=term;if(Math.abs(term)<Math.abs(sum)*1e-14)break}
  return Math.max(0,Math.min(1,1-sum*Math.exp(-x+a*Math.log(x)-gln)));
 }
 let b=x+1-a,c=1e30,d=1/(Math.abs(b)<1e-30?1e-30:b),h=d;
 for(let i=1;i<1000;i++){
  const an=-i*(i-a);
  b+=2;d=an*d+b;if(Math.abs(d)<1e-30)d=1e-30;
  c=b+an/c;if(Math.abs(c)<1e-30)c=1e-30;
  d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<1e-14)break;
 }
 return Math.max(0,Math.min(1,Math.exp(-x+a*Math.log(x)-gln)*h));
}
export function contingencyAnalysis(payload,{maxGroups=12}={}){
 if(!payload||Array.isArray(payload)||typeof payload!=="object")throw Error("Supply an aggregate table.");
 if(!Array.isArray(payload.groups)||payload.groups.length<2||payload.groups.length>maxGroups)
  throw Error("Provide between 2 and "+maxGroups+" group counts.");
 const names=new Set(),entries=[],maxCount=100000000;
 for(const group of payload.groups){
  if(!group||typeof group!=="object")throw Error("Invalid group.");
  const name=String(group.name||"").trim();
  if(!name||name.length>80||names.has(name))throw Error("Group names must be unique and <=80 characters.");
  names.add(name);
  const closed=group.closed,nonclosed=group.nonclosed;
  if(![closed,nonclosed].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=maxCount))throw Error("Counts must be nonnegative safe integers <=100,000,000.");
  if(closed+nonclosed===0)throw Error("Empty groups are not comparable.");
  entries.push({name,closed,nonclosed,n:closed+nonclosed});
 }
 const n=entries.reduce((s,g)=>s+g.n,0),events=entries.reduce((s,g)=>s+g.nonclosed,0),closures=n-events;
 if(events===0||closures===0)throw Error("Both documented closure and nonclosure outcomes are required for chi-square.");
 let chiSquare=0,smallExpected=0,verySmall=0;
 const expected=[];
 for(const row of entries){
  const e1=row.n*events/n,e0=row.n*closures/n;
  expected.push({name:row.name,nonclosed:e1,closed:e0});
  for(const [obs,exp] of [[row.nonclosed,e1],[row.closed,e0]]){
   chiSquare+=(obs-exp)*(obs-exp)/exp;
   if(exp<5)smallExpected++;
   if(exp<1)verySmall++;
  }
 }
 const df=entries.length-1,unsafe=verySmall>0||smallExpected/(entries.length*2)>0.2;
 const groups=entries.map(g=>{
  const peerEvents=events-g.nonclosed,peerN=n-g.n,rate=g.nonclosed/g.n,peerRate=peerN?peerEvents/peerN:null;
  const [lower,upper]=wilson(g.nonclosed,g.n);
  const riskDifference=peerN?rate-peerRate:null;
  const standardError=peerN?Math.sqrt(rate*(1-rate)/g.n+peerRate*(1-peerRate)/peerN):null;
  return {...g,nonclosureRate:rate,wilson95Low:lower,wilson95High:upper,
    peerN,peerRate,riskDifference,
    riskDifference95Low:standardError===null?null:Math.max(-1,riskDifference-1.959963984540054*standardError),
    riskDifference95High:standardError===null?null:Math.min(1,riskDifference+1.959963984540054*standardError)};
 });
 return {total:n,events,closed:closures,groups,chiSquare,degreesOfFreedom:df,
  pValue:unsafe?null:upperGammaQ(df/2,chiSquare/2),
  cramersV:Math.sqrt(chiSquare/n),
  expected,assumptionsPass:!unsafe,
  notes:unsafe?["Chi-square asymptotic p-value withheld: low expected cell counts. Consider exact or simulation-based tests in Kaggle."]:
    ["Pearson chi-square approximates the null distribution; observations must be independent.","Wilson intervals are for individual group nonclosure proportions.","Risk difference intervals use approximate unadjusted normal standard errors.","This test measures association, not causation."]};
}