import {analyzeCPU} from "./cpu-research.mjs";
import {evaluatePredictionModels} from "./prediction.mjs";
import {analyzeContent} from "./content-analysis.mjs";
// Both expensive routes run in a dedicated browser CPU thread, not the UI thread.
self.addEventListener("message",event=>{
 const {type,rows,mapping,config,jobId}=event.data||{};
 try{
  const result=type==="research"?analyzeCPU(rows,mapping,config)
    :type==="prediction"?evaluatePredictionModels(rows,mapping,config)
    :type==="content"?analyzeContent(rows,config)
    :(()=>{throw Error("Unknown analysis job")})();
  self.postMessage({jobId,ok:true,result});
 }catch(error){self.postMessage({jobId,ok:false,error:String(error.message||error)})}
});