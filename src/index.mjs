/**
 * MABRIG GovFriction Lab: actual Cloudflare Worker entry point.
 * Private bindings remain server-side; existing local-first HTML and JS assets stay unchanged.
 * No remote dataset storage, no secret values in API responses.
 */
import { contingencyAnalysis } from "./statistics.mjs";

const headers={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer",
  "cross-origin-resource-policy":"same-origin"
};
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers})}
const parseBoolean=(value,def=false)=>value===undefined?def:String(value).toLowerCase()==="true";
const bound=(value,fallback=12)=>Math.max(2,Math.min(25,Number.isSafeInteger(Number(value))?Number(value):fallback));
function config(env){
 const mode=String(env.APP_MODE||"research-pilot");
 return {service:"MABRIG GovFriction Lab",runtime:"cloudflare-worker",release:"0.4.0",
  appMode:["research-pilot","staging","production"].includes(mode)?mode:"research-pilot",
  serverAggregateAnalysis:parseBoolean(env.ENABLE_SERVER_ANALYTICS,true),
  maxAggregateGroups:bound(env.MAX_AGGREGATE_GROUPS,12),
  backendStorage:env.DB?"configured (not used for submitted statistics)":"not configured",
  rawDataUpload:false,loginRequired:false,secretValuesExposed:false,
  computingPolicy:"Bounded aggregate counts only; raw service-request rows stay in the browser."};
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname.startsWith("/api/")){
   if(request.method==="OPTIONS")return new Response(null,{status:405,headers:{allow:"GET, HEAD, POST",...headers}});
   if(url.pathname==="/api/health"||url.pathname==="/api/config"){
    if(!["GET","HEAD"].includes(request.method))return json({error:"Method not allowed"},405);
    const data=config(env);
    return request.method==="HEAD"?new Response(null,{status:200,headers}):json(data);
   }
   if(url.pathname==="/api/analysis/contingency"){
    if(request.method!=="POST")return json({error:"POST required"},405);
    if(!config(env).serverAggregateAnalysis)return json({error:"Server aggregate analysis is disabled by deployment settings."},503);
    const origin=request.headers.get("origin");
    if(origin){
     try{if(new URL(origin).origin!==url.origin)return json({error:"Cross-origin statistical submissions are not allowed."},403)}
     catch{return json({error:"Invalid origin"},403)}
    }
    if(!(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))return json({error:"Use application/json."},415);
    const length=Number(request.headers.get("content-length")||0);
    if(length>16384)return json({error:"Aggregate request exceeds 16 KiB."},413);
    let payload;
    try{
     // Fail closed for streaming submissions without Content-Length too.
     const reader=request.body?.getReader();
     if(!reader)return json({error:"Missing request body"},400);
     const chunks=[];let lengthRead=0;
     while(true){
      const {done,value}=await reader.read();
      if(done)break;lengthRead+=value.byteLength;
      if(lengthRead>16384){await reader.cancel();return json({error:"Aggregate request exceeds 16 KiB."},413)}
      chunks.push(value);
     }
     const buffer=new Uint8Array(lengthRead);let pos=0;
     for(const chunk of chunks){buffer.set(chunk,pos);pos+=chunk.byteLength}
     payload=JSON.parse(new TextDecoder().decode(buffer));
    }catch{return json({error:"Invalid aggregate JSON."},400)}
    try{
     const result=contingencyAnalysis(payload,{maxGroups:config(env).maxAggregateGroups});
     return json({protocol:"govfriction-aggregate-contingency-v1",origin:"Cloudflare Worker CPU",...result,
       caution:"Descriptive association only. This does not prove that geographical location caused request delays."});
    }catch(error){return json({error:error.message},422)}
   }
   return json({error:"API route not found"},404);
  }
  // Static HTML/CSS/JS continue to use Cloudflare Workers asset service.
  return env.ASSETS.fetch(request);
 }
};