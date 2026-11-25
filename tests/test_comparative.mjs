import assert from 'node:assert/strict';
import {compareIndicators,comparisonSvg} from '../web/comparative.mjs';
const group=(borough,n,d,f,score,p=.3)=>({service:'Graffiti',borough,n:20,peerN:40,nonclosure30:n,delayBurden30:d,friction:f,score,peerFriction:p,asymmetry:Math.abs(f-p)});
const report={protocol:'bfs-dai-0.1',source:{synthetic:true},config:{horizonDays:30},groups:[group('A',.1,.2,.15,30),group('B',.2,.4,.3,20),group('C',.3,.6,.45,50),{...group('D',.5,.7,.6,20),score:null}]};
const r=compareIndicators(report);assert.equal(r.summaries[0].comparable,3);assert.equal(r.summaries[0].suppressed,1);assert.equal(r.summaries[0].nonclosureDelaySpearman,1);assert.equal(r.summaries[0].changedRanks,2);assert.equal(r.rows.find(x=>x.borough==='D').bfsDaiRank,null);assert.equal(r.rows.find(x=>x.borough==='A').signedPeerGap,-15);assert.match(comparisonSvg(r,'Graffiti'),/SYNTHETIC/);
const tie=compareIndicators({...report,groups:[group('A',.1,.2,.15,20),group('B',.1,.2,.15,20),group('C',.1,.2,.15,20)]});assert.equal(tie.summaries[0].indexFrictionSpearman,null);assert.equal(tie.rows[0].bfsDaiRank,2);
const x=compareIndicators({...report,groups:[{...group('<script>',.1,.2,.15,20),service:'A&B'}]});assert.match(comparisonSvg(x,'A&B'),/A&amp;B/);assert.ok(!comparisonSvg(x,'A&B').includes('<script>'));
console.log('PASS: within-service indicator comparison, suppression, ties and SVG escaping');
