import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {createApp} from "../src/server.js";
import {analyzeEssay,extractEssayJson,normalizeEssayAnalysis} from "../src/essayClient.js";
const input={school:"MIT",essayType:"Common App Essay",prompt:"",essayText:"My own story."};
const analysis={summary:"Clear start",scores:{story:70,structure:80,voice:85,language:75,promptFit:60},strengths:["Specific details"],issues:[{title:"Structure",detail:"Clarify the turning point"}],suggestions:["Add a reflection"],revisedDraft:"My revised story."};
async function server(t,options={}){
 const s=createApp(options).listen(0,"127.0.0.1");await once(s,"listening");
 t.after(()=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();}));
 return (body,raw=false)=>fetch("http://127.0.0.1:"+s.address().port+"/api/essay/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:raw?body:JSON.stringify(body)});
}
test("essay API rejects missing, long and malformed inputs before invoking Kimi",async t=>{
 let calls=0;const post=await server(t,{essayRateLimitMax:30,queryEssay:async()=>{calls++;return analysis;}});
 for(const body of [{...input,essayText:undefined},{...input,essayText:" "},{...input,essayText:"a".repeat(12001)},{...input,prompt:"a".repeat(3001)},{...input,school:[]},{...input,essayType:"unknown"}])assert.equal((await post(body)).status,400);
 assert.equal((await post("{bad}",true)).status,400);
 assert.equal((await post(JSON.stringify({...input,essayText:"a".repeat(110000)}),true)).status,400);
 assert.equal(calls,0);
});
test("mocked essay success returns JSON; failure is sanitized and is never cached",async t=>{
 let calls=0;const post=await server(t,{queryEssay:async()=>{calls++;if(calls===1)return analysis;throw new Error("PRIVATE ESSAY BODY");}});
 assert.deepEqual(await(await post(input)).json(),analysis);
 const failed=await post(input);assert.equal(failed.status,503);assert.ok(!JSON.stringify(await failed.json()).includes("PRIVATE"));
 assert.equal(calls,2);
});
test("essay rate limiting returns 429 and Retry-After",async t=>{
 const post=await server(t,{essayRateLimitMax:1,queryEssay:async()=>analysis});
 assert.equal((await post(input)).status,200);const limited=await post(input);assert.equal(limited.status,429);assert.ok(limited.headers.get("retry-after"));
});
test("essay client omits tools, normalizes no-prompt feedback and never echoes unknown fields",async()=>{
 let body;const fence=String.fromCharCode(96).repeat(3);
 const result=await analyzeEssay(input,{apiKey:"test-placeholder",fetchImpl:async(_url,request)=>{body=JSON.parse(request.body);return {ok:true,json:async()=>({choices:[{finish_reason:"stop",message:{content:fence+"json\n"+JSON.stringify({...analysis,secret:"ignore"})+"\n"+fence}}]})};}});
 assert.equal(body.model,"kimi-k2.6");assert.equal(body.tools,undefined);
 assert.equal(result.scores.promptFit,null);assert.equal(result.secret,undefined);
 assert.ok(body.messages[0].content.includes("不得编造"));
});
test("essay JSON parser handles prose, quoted braces and invalid JSON; rejects invalid scores",()=>{
 const data={...analysis,summary:'A "quoted" {story}'};
 assert.deepEqual(extractEssayJson("Here is feedback:\n"+JSON.stringify(data)+"\nDone"),data);
 assert.throws(()=>extractEssayJson("not JSON"));
 assert.throws(()=>normalizeEssayAnalysis({...analysis,scores:{...analysis.scores,story:101}}));
 assert.throws(()=>normalizeEssayAnalysis({...analysis,strengths:"bad"}));
});
test("essay timeout covers response body, and truncated responses fail",async()=>{
 await assert.rejects(analyzeEssay(input,{apiKey:"test-placeholder",timeoutMs:5,fetchImpl:async(_u,{signal})=>({ok:true,json:()=>new Promise((_r,reject)=>signal.addEventListener("abort",()=>reject(new Error("timeout"))))})}),/timeout/);
 await assert.rejects(analyzeEssay(input,{apiKey:"test-placeholder",fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:"length"}]})})}),/Incomplete/);
});
