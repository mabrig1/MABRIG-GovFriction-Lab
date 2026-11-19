/* R Statistics Lab: fixed, auditable base-R calculations run locally in webR. */
export const R_VERSION='govfriction-r-v0.1';
export const MAX_R_ROWS=10000;
const NUM=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const blank=v=>v==null||String(v).trim()==='';
export function numeric(v){if(blank(v))return null;const s=String(v).trim();if(!NUM.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
export function profile(rows,heads){
 return heads.map(name=>{
  let valid=0,n=0;const levels=new Set();
  for(const row of rows){
   const val=row[name];if(blank(val))continue;
   valid++;if(numeric(val)!==null)n++;if(levels.size<1001)levels.add(String(val));
  }
  return {name,kind:valid&&valid===n?'numeric':'categorical',valid,missing:rows.length-valid,levels:levels.size,mixed:n>0&&n<valid};
 });
}
export function derive(rows,{name,left,right,constant,op}){
 if(!rows.length)throw Error('Load data first.');
 if(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name||''))throw Error('Variable name must be a letter followed by letters, digits or underscore.');
 if(Object.hasOwn(rows[0],name))throw Error('Variable name already exists.');
 if(!Object.hasOwn(rows[0],left))throw Error('Choose an existing source variable.');
 if(right!=='__constant__'&&!Object.hasOwn(rows[0],right))throw Error('Choose a second variable.');
 if(!['+','-','*','/'].includes(op))throw Error('Choose a supported operation.');
 if(right==='__constant__'&&numeric(constant)===null)throw Error('Enter a numeric constant.');
 let missing=0,zero=0;
 const data=rows.map(row=>{
  const a=numeric(row[left]),b=right==='__constant__'?numeric(constant):numeric(row[right]);let output='';
  if(a!==null&&b!==null){
   if(op==='/'&&b===0)zero++;
   else {const v=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b;if(Number.isFinite(v))output=String(v);}
  }
  if(output==='')missing++;
  return {...row,[name]:output};
 });
 return {data,missing,zero,name,formula:{left,right,op,constant:right==='__constant__'?Number(constant):null}};
}
const quote=v=>JSON.stringify(String(v)).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function asR(values,isNum){return (isNum?'c(':'factor(c(')+values.map(v=>v===null?(isNum?'NA_real_':'NA_character_'):isNum?String(v):quote(v)).join(',')+(isNum?')':'))');}
export function buildR(rows,options={}){
 const {test='descriptive',x='',y='',group=''}=options;
 const modes=new Set(['descriptive','pearson','spearman','welch','anova','linear','chisquare']);
 if(!modes.has(test))throw Error('Select a supported test.');
 if(rows.length<3)throw Error('At least 3 rows required.');
 if(rows.length>MAX_R_ROWS)throw Error('WebR pilot limit is 10,000 cases; use exported R script on a workstation for larger datasets.');
 const heads=Object.keys(rows[0]);
 const usesX=['descriptive','pearson','spearman','linear','chisquare'].includes(test);
 const usesY=['pearson','spearman','linear','welch','anova'].includes(test);
 const usesG=['welch','anova','chisquare'].includes(test);
 const xNum=test!=='chisquare',yNum=true;
 for(const name of [usesX?x:null,usesY?y:null,usesG?group:null].filter(v=>v!==null))if(!heads.includes(name))throw Error('Select required variables.');
 const columns={
  x:usesX?rows.map(r=>xNum?numeric(r[x]):blank(r[x])?null:String(r[x]).trim()):[],
  y:usesY?rows.map(r=>numeric(r[y])):[],
  g:usesG?rows.map(r=>blank(r[group])?null:String(r[group]).trim()):[]
 };
 const active=(usesX?['x']:[]).concat(usesY?['y']:[],usesG?['g']:[]);
 const eligible=rows.map((_,i)=>i).filter(i=>active.every(k=>columns[k][i]!==null));
 if(eligible.length<3)throw Error('At least 3 complete cases required.');
 if(usesG){
  const counts=new Map();for(const i of eligible)counts.set(columns.g[i],(counts.get(columns.g[i])||0)+1);
  if(counts.size<2||counts.size>12)throw Error('Grouping requires 2–12 levels.');
  if(test==='welch'&&counts.size!==2)throw Error('Welch test requires exactly two groups.');
  if(['welch','anova'].includes(test)&&[...counts.values()].some(n=>n<2))throw Error('Each numeric comparison group needs at least 2 observations.');
 }
 if(test==='chisquare'){
  const k=new Set(eligible.map(i=>columns.x[i])).size;
  if(k<2||k>12)throw Error('Chi-square needs 2–12 levels in categorical predictor.');
 }
 if(['pearson','spearman','linear'].includes(test)&&
  (new Set(eligible.map(i=>columns.x[i])).size<2||new Set(eligible.map(i=>columns.y[i])).size<2))
  throw Error('Numerical predictors and outcomes must vary.');
 const initial=[];
 if(usesX)initial.push('x <- '+asR(columns.x,xNum));
 if(usesY)initial.push('y <- '+asR(columns.y,yNum));
 if(usesG)initial.push('g <- '+asR(columns.g,false));
 const methods={
 descriptive:[
  'v <- x[is.finite(x)]',
  'cat("N =", length(v), "; missing =", sum(!is.finite(x)), "\\n")',
  'print(summary(v))',
  'cat("Mean:",mean(v),"Sample SD:",sd(v),"Median:",median(v),"IQR:",IQR(v),"\\n")',
  'if(length(v)>1L)print(t.test(v)$conf.int)'
 ],
 pearson:['ok <- complete.cases(x,y)','cat("Complete pairs:",sum(ok),"\\n")','print(cor.test(x[ok],y[ok],method="pearson"))'],
 spearman:['ok <- complete.cases(x,y)','cat("Complete pairs:",sum(ok),"\\n")','print(cor.test(x[ok],y[ok],method="spearman",exact=FALSE))'],
 welch:['d <- na.omit(data.frame(y=y,g=g))','print(table(d$g))','print(t.test(y ~ g,data=d,var.equal=FALSE))'],
 anova:['d <- na.omit(data.frame(y=y,g=g))','print(table(d$g))','fit <- aov(y ~ g,data=d)','print(summary(fit))','print(tapply(d$y,d$g,mean))'],
 linear:['d <- na.omit(data.frame(y=y,x=x))','fit <- lm(y ~ x,data=d)','print(summary(fit))','cat("RMSE:",sqrt(mean(residuals(fit)^2)),"\\n")'],
 chisquare:['tab <- table(x,g)','print(tab)','out <- suppressWarnings(chisq.test(tab,correct=FALSE))','print(out$expected)',
  'if(any(out$expected<1)||mean(out$expected<5)>.2){cat("Asymptotic p-value withheld: low expected counts.\\n")} else print(out)',
  'cat("Cramer V:",sqrt(as.numeric(out$statistic)/(sum(tab)*min(nrow(tab)-1,ncol(tab)-1))),"\\n")']
 };
 const script=['# MABRIG GovFriction Lab reproducible base R calculations',
  '# Input values appear below. No external data transfer is necessary.',
  ...initial,...methods[test]].join('\n');
 const expression='paste(capture.output({\n'+script+'\n}),collapse="\\n")';
 return {test,n:rows.length,complete:eligible.length,script,expression,
  variables:{x,y,group},note:'True base-R calculations via optional webR in this browser; research assumptions must be reviewed.'};
}
