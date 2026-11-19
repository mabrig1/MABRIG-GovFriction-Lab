/* Write reproducible R scripts for CPU execution in CI. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {buildR} from '../web/r-statistics.mjs';
const rows=[];
for(let i=1;i<=20;i++)rows.push({
 x:String(i), y:String(2*i+5), group:i<=10?'A':'B',category:i%2?'YES':'NO'
});
mkdirSync('tmp/r-smoke',{recursive:true});
const cases=[
 ['descriptive',{test:'descriptive',x:'x'}],
 ['pearson',{test:'pearson',x:'x',y:'y'}],
 ['spearman',{test:'spearman',x:'x',y:'y'}],
 ['welch',{test:'welch',y:'y',group:'group'}],
 ['anova',{test:'anova',y:'y',group:'group'}],
 ['linear',{test:'linear',x:'x',y:'y'}],
 ['chisquare',{test:'chisquare',x:'category',group:'group'}]
];
for(const [name,options] of cases){
 const study=buildR(rows,options);
 writeFileSync('tmp/r-smoke/'+name+'.R',study.script+'\n','utf8');
}
console.log('Generated '+cases.length+' fixed Base R smoke scripts');
