import {strict as assert} from 'node:assert';
import {numeric,profile,derive,buildR,MAX_R_ROWS} from '../web/r-statistics.mjs';
import {readThemes,analyzeContent} from '../web/content-analysis.mjs';
import {modelChart} from '../web/visualization.mjs';

assert.equal(numeric('2.5'),2.5);
assert.equal(numeric('  '),null);
assert.equal(numeric('Infinity'),null);
assert.equal(numeric('1,000'),null);
assert.equal(numeric('3e2'),300);
const rows=[
 {a:'1',b:'2',group:'A',text:'Service delay service delay'},
 {a:'2',b:'4',group:'A',text:'Delay service'},
 {a:'3',b:'6',group:'B',text:''},
 {a:'4',b:'8',group:'B',text:'No reply from agency'}
];
const prof=profile(rows,Object.keys(rows[0]));
assert.equal(prof.find(r=>r.name==='a').kind,'numeric');
assert.equal(prof.find(r=>r.name==='text').missing,1);
const computed=derive(rows,{name:'added',left:'a',right:'b',op:'+'});
assert.equal(computed.data[0].added,'3');
assert.equal(computed.data[3].added,'12');
assert.equal(computed.missing,0);
assert.notEqual(Object.hasOwn(rows[0],'added'),true);
const divided=derive(rows,{name:'ratio',left:'a',right:'__constant__',constant:0,op:'/'});
assert.equal(divided.zero,4);
assert.equal(divided.missing,4);
assert.throws(()=>derive(rows,{name:'danger";',left:'a',right:'b',op:'+'}),/name/);
assert.throws(()=>derive(rows,{name:'existing',left:'other',right:'b',op:'+'}),/source/);
for(const [test,x,y,group] of [
 ['descriptive','a','',''],['pearson','a','b',''],['spearman','a','b',''],['linear','a','b',''],
 ['welch','','b','group'],['anova','','b','group'],['chisquare','group','','text']
]){
 if(test==='chisquare')continue;
 const out=buildR(rows,{test,x,y,group});
 assert.equal(out.n,4);
 assert.ok(out.script.includes(' <- '));
 assert.ok(out.expression.includes('capture.output'));
}
const ci=buildR(rows,{test:'chisquare',x:'group',group:'a'});
assert.ok(ci.script.includes('chisq.test'));
assert.ok(ci.script.includes('WITHHELD')===false||ci.script.length>100);
assert.throws(()=>buildR(rows,{test:'welch',y:'b',group:'text'}),/exactly two/);
assert.throws(()=>buildR(rows,{test:'nope',x:'a'}),/supported/);
assert.throws(()=>buildR(Array(MAX_R_ROWS+1).fill(rows[0]),{test:'descriptive',x:'a'}),/limit/);
const evil=buildR([{a:'1',group:'");system("bad")'},{a:'2',group:'safe'},{a:'3',group:'safe'}],{test:'chisquare',x:'group',group:'a'});
assert.ok(evil.script.includes('\\");system(\\"bad\\")'));
const themes=readThemes('Service delay: service delay, no reply\nFeedback: feedback, answered');
assert.equal(themes.length,2);
assert.throws(()=>readThemes('Bad format'),/Theme/);
const content=analyzeContent(rows,{column:'text',themes:'Service delay: service delay, no reply',minTermLength:3,top:10});
assert.equal(content.nonempty,3);
assert.equal(content.missing,1);
assert.equal(content.frequentTerms.find(t=>t.term==='service').count,3);
assert.equal(content.frequentTerms.find(t=>t.term==='delay').count,3);
assert.equal(content.bigrams.find(t=>t.term==='service delay').count,2);
assert.equal(content.themes[0].documents,2);
assert.equal(content.themes[0].hits,3);
assert.ok(content.tfidf.every(t=>Number.isFinite(t.score)));
assert.ok(!JSON.stringify(content).includes('No reply from agency'),'Aggregate report must omit original text');
assert.throws(()=>analyzeContent(rows,{column:'missing'}),/text column/);
const bar=modelChart(rows,{type:'bar',x:'group',max:10});
assert.deepEqual(bar.points.map(p=>p.value),[2,2]);
const line=modelChart(rows,{type:'line',x:'group',y:'a',max:10});
assert.deepEqual(line.points.map(p=>p.value),[1.5,3.5]);
const scatter=modelChart(rows,{type:'scatter',x:'a',y:'b',max:10});
assert.equal(scatter.points.length,4);
assert.throws(()=>modelChart(rows,{type:'histogram',x:'group'}),/numerical/);
const hist=modelChart(rows,{type:'histogram',x:'a'});
assert.equal(hist.points.reduce((s,p)=>s+p.value,0),4);
console.log('PASS: R variable editor, 7 R methods, script quoting, content-analysis tokens, TF-IDF, themes and 4 chart types');
