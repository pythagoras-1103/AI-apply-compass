import dotenv from 'dotenv';
import {fetchKimiChecklist,kimiFailureReason} from '../src/kimiClient.js';
import {analyzeEssay} from '../src/essayClient.js';
// Resolve Windows drive paths and spaces via fileURLToPath.
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url))});
const key=process.env.MOONSHOT_API_KEY?.trim();
console.log('Node:',process.version,'Key configured:',Boolean(key));
if(!key){console.error('请填写项目根目录 .env 的 MOONSHOT_API_KEY');process.exitCode=1;}
else {
 try{
 const r=await fetch('https://api.moonshot.cn/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(20000)});
 console.log('认证/模型列表 HTTP:',r.status);
 if(!r.ok)process.exitCode=1;
 else {const d=await r.json();console.log('kimi-k2.6 available:',d.data?.some(m=>m.id==='kimi-k2.6'));
 if(process.argv.includes('--live')){
 console.log('正在执行真实搜索和文书测试，将使用少量 API 额度。');
 try{const items=await fetchKimiChecklist('哈佛大学',{onDiagnostic:d=>console.log('材料阶段:',JSON.stringify(d))});console.log('材料成功，条目数:',items.length);}catch(e){console.error('材料失败:',kimiFailureReason(e));process.exitCode=1;}
 try{const result=await analyzeEssay({school:'Harvard University',essayType:'Other',essayText:'I began learning programming by building a small application for my family. Debugging taught me to ask precise questions and to test my assumptions. I want to continue learning how technology can help people solve everyday problems.'});console.log('文书成功，评分项:',Object.keys(result.scores).length);}catch{console.error('文书测试失败');process.exitCode=1;}
 }
 }
 }catch(e){console.error('网络/超时:',e.cause?.code||e.name);process.exitCode=1;}
}
