/* Transparent, repeatable uncertainty for frozen out-of-time predictive comparisons.
 * Paired resampling of UTC creation-DAY clusters, not resampling training records.
 * Reuses each fixed prediction; NEVER refits or tunes to the test window.
 */
const DEFAULT_REPLICATIONS=499;
const DEFAULT_SEED=20261120;
const DAY=86400000;

function quantile(values,q){
  const sorted=[...values].sort((a,b)=>a-b);
  const pos=(sorted.length-1)*q,lower=Math.floor(pos),fraction=pos-lower;
  return sorted[lower]+fraction*(sorted[Math.min(lower+1,sorted.length-1)]-sorted[lower]);
}
function seededRandom(seed){
  let s=seed>>>0;
  return ()=>{
    s=(Math.imul(s,1664525)+1013904223)>>>0;
    return (s+0.5)/4294967296;
  };
}
const roundNumber=x=>Number(x.toFixed(10));
export function pairedDayBootstrap(testRows,labels,models,{replications=DEFAULT_REPLICATIONS,seed=DEFAULT_SEED}={}){
  if(!Array.isArray(testRows)||!Array.isArray(labels)||!Array.isArray(models)||
     labels.length!==testRows.length||models.length<2||
     !Number.isSafeInteger(replications)||replications<99||replications>999||
     !Number.isSafeInteger(seed))throw Error("Invalid held-out bootstrap data or settings.");
  if(testRows.length<20||labels.some(v=>v!==0&&v!==1)||
    models.some(m=>typeof m.name!=="string"||!m.name||!Array.isArray(m.probabilities)||
      m.probabilities.length!==labels.length||
      m.probabilities.some(p=>typeof p!=="number"||!Number.isFinite(p)||p<0||p>1)))
    throw Error("Unusable paired held-out data. Do not estimate uncertainty.");
  const groups=new Map();
  const totals=Array(models.length).fill(0);
  for(let i=0;i<labels.length;i++){
    const ms=testRows[i]?.created;
    if(!Number.isFinite(ms))throw Error("Holdout creation dates are required.");
    const day=Math.floor(ms/DAY);
    let bucket=groups.get(day);
    if(!bucket){bucket={n:0,loss:Array(models.length).fill(0)};groups.set(day,bucket)}
    bucket.n++;
    for(let m=0;m<models.length;m++){
      const e=(models[m].probabilities[i]-labels[i])**2;
      bucket.loss[m]+=e;totals[m]+=e;
    }
  }
  const days=[...groups.values()],clusters=days.length;
  const result={method:"Paired UTC-day cluster bootstrap of held-out Brier scores, without model refitting",
    status:clusters>=8?"estimated":"insufficient-distinct-days",
    n:testRows.length,distinctDays:clusters,replications,seed,
    baselineName:models[0].name,
    estimates:[],
    caution:"Exploratory 95% percentile intervals conditional on frozen fitted models, study window and chosen day clusters. Day clusters address within-day dependence but NOT cross-day serial correlation, model-training uncertainty, fairness or external validity. No p-value or causal claim."};
  if(clusters<8){
    result.reason="At least eight distinct held-out UTC creation days are required to attempt this cluster resampling.";
    return result;
  }
  const distributions=models.map(()=>({brier:[],improvement:[]}));
  const random=seededRandom(seed);
  for(let b=0;b<replications;b++){
    const sums=Array(models.length).fill(0);let n=0;
    for(let d=0;d<clusters;d++){
      const sample=days[Math.floor(random()*clusters)];n+=sample.n;
      for(let m=0;m<sums.length;m++)sums[m]+=sample.loss[m];
    }
    for(let m=0;m<sums.length;m++){
      distributions[m].brier.push(sums[m]/n);
      distributions[m].improvement.push((sums[0]-sums[m])/n);
    }
  }
  for(let m=0;m<models.length;m++){
    const brier=totals[m]/testRows.length;
    const improvement=(totals[0]-totals[m])/testRows.length;
    const bs=distributions[m];
    result.estimates.push({name:models[m].name,
      brier:roundNumber(brier),
      brier95:{lower:roundNumber(quantile(bs.brier,0.025)),upper:roundNumber(quantile(bs.brier,0.975))},
      brierImprovementVsBaseline:roundNumber(improvement),
      improvement95:{lower:roundNumber(quantile(bs.improvement,0.025)),
        upper:roundNumber(quantile(bs.improvement,0.975))}
    });
  }
  return result;
}
