/* Deterministic transparent computational content analysis. No LLM or external calls. */
export const CONTENT_PROTOCOL='govfriction-content-v0.1';
const STOP=new Set('a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its may more most my no not of on or our out over she should so some such than that the their them there these they this those to was were what when where which who why will with would you your also via about under after before between during each per new same'.split(' '));
const tokenize=text=>String(text||'').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu)||[];
const normalizePhrase=text=>tokenize(text).join(' ');
export function readThemes(input){
 const themes=[];
 for(const line of String(input||'').split(/\r?\n/)){
  if(!line.trim())continue;
  const idx=line.indexOf(':');
  if(idx<1)throw Error('Use Theme: word, multi-word phrase on each line.');
  const name=line.slice(0,idx).trim();
  if(name.length>55||!name||themes.some(t=>t.name.toLowerCase()===name.toLowerCase()))throw Error('Theme labels must be unique and under 56 characters.');
  const terms=[...new Set(line.slice(idx+1).split(',').map(normalizePhrase).filter(Boolean))];
  if(!terms.length||terms.length>30)throw Error('Each theme needs 1–30 keywords or phrases.');
  themes.push({name,terms});
 }
 if(themes.length>15)throw Error('Use at most 15 dictionary themes.');
 return themes;
}
function phraseCount(tokens,phrase){
 const target=phrase.split(' ');
 let n=0;
 for(let i=0;i<=tokens.length-target.length;i++){
  if(target.every((v,j)=>tokens[i+j]===v))n++;
 }
 return n;
}
function topCounts(map,max=25){return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,max).map(([term,count])=>({term,count}));}
export function analyzeContent(rows,{column,themes='',minTermLength=3,top=20}={}){
 if(!rows.length||!Object.hasOwn(rows[0],column))throw Error('Select a valid text column.');
 if(rows.length>3000)throw Error('Content-analysis pilot limit: 3,000 documents. Work with a documented subset or a larger local pipeline.');
 if(!Number.isInteger(minTermLength)||minTermLength<1||minTermLength>12)throw Error('Minimum token length must be 1–12.');
 if(!Number.isInteger(top)||top<5||top>100)throw Error('Top terms must be 5–100.');
 const dictionary=readThemes(themes),frequencies=new Map(),pairs=new Map(),docfreq=new Map(),themeCounts=new Map(dictionary.map(x=>[x.name,{documents:0,hits:0,keywords:x.terms}]));
 let totalTokens=0,nonempty=0,missing=0,chars=0;
 const prepared=[];
 for(const row of rows){
  const raw=String(row[column]??'').trim();chars+=raw.length;
  if(chars>1800000)throw Error('Text workload exceeds 1.8 million characters; split the corpus with a documented rule.');
  if(!raw){missing++;continue}
  const words=tokenize(raw),terms=words.filter(t=>t.length>=minTermLength&&!STOP.has(t));
  totalTokens+=words.length;nonempty++;
  const occurrence=new Map();
  for(const term of terms){frequencies.set(term,(frequencies.get(term)||0)+1);occurrence.set(term,(occurrence.get(term)||0)+1)}
  for(const term of occurrence.keys())docfreq.set(term,(docfreq.get(term)||0)+1);
  for(let i=0;i<terms.length-1;i++){const pair=terms[i]+' '+terms[i+1];pairs.set(pair,(pairs.get(pair)||0)+1)}
  const themeHits={};
  for(const theme of dictionary){
   const hits=theme.terms.reduce((sum,term)=>sum+phraseCount(words,term),0);
   themeHits[theme.name]=hits;
   const group=themeCounts.get(theme.name);
   group.hits+=hits;if(hits)group.documents++;
  }
  prepared.push({terms,occurrence,themeHits});
 }
 if(!nonempty)throw Error('There are no usable documents in the chosen text column.');
 const scores=new Map();
 for(const doc of prepared)for(const [term,count] of doc.occurrence){
  const tf=count/Math.max(1,doc.terms.length),idf=Math.log((1+nonempty)/(1+docfreq.get(term)))+1;
  scores.set(term,(scores.get(term)||0)+tf*idf);
 }
 const tfidf=[...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,top).map(([term,score])=>({term,score,documentFrequency:docfreq.get(term)}));
 const themeOutput=[...themeCounts].map(([name,v])=>({name,documents:v.documents,hits:v.hits,documentPercent:100*v.documents/nonempty,keywords:v.keywords}));
 return {protocol:CONTENT_PROTOCOL,column,documents:rows.length,nonempty,missing,totalTokens,
  distinctTerms:frequencies.size,settings:{minTermLength,top,stopWords:'Built-in English stopword list; no stemming'},
  frequentTerms:topCounts(frequencies,top),bigrams:topCounts(pairs,top),tfidf,themes:themeOutput,
  caveats:['Word counting is descriptive, not semantic understanding.',
   'User-defined dictionary themes are transparent lexical rules; they do not prove document intent.',
   'TF-IDF scores are sums of per-document normalized term frequencies times smoothed inverse document frequency.',
   'English stopwords may be inappropriate for multilingual corpora. Inspect language and tokenization.',
   'Personal, confidential and identifiable text should not be pasted into external AI services.',
   'Aggregate export excludes original document text.']};
}
