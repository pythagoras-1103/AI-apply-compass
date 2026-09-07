import {mountSite,getUniversities,escapeHtml as h,toast} from "./shared.js";
import {resolveSchool} from "./storage.js";
mountSite("essay");
const form=document.querySelector("#essayForm"),schoolSelect=document.querySelector("#essaySchool"),other=document.querySelector("#otherSchoolField"),input=document.querySelector("#essayText"),results=document.querySelector("#essayResults"),button=document.querySelector("#analyzeButton"),status=document.querySelector("#essayStatus");
let submitting=false;
schoolSelect.addEventListener("change",()=>{other.hidden=schoolSelect.value!=="other";document.querySelector("#otherSchool").required=schoolSelect.value==="other";});
input.addEventListener("input",()=>{const words=input.value.trim()?input.value.trim().split(/\s+/u).length:0;document.querySelector("#wordCount").textContent=input.value.length+" / 12000 字符 · "+words+" 个空格分词";});
getUniversities().then(schools=>{
 for(const s of schools){const option=document.createElement("option");option.value=s.name;option.textContent=s.shortName;schoolSelect.append(option);}
 const option=document.createElement("option");option.value="other";option.textContent="其他学校";schoolSelect.append(option);
 const requested=new URLSearchParams(location.search).get("school");
 if(requested){const s=resolveSchool(requested,schools);if(schools.some(u=>u.id===s.id))schoolSelect.value=s.name;else{schoolSelect.value="other";other.hidden=false;document.querySelector("#otherSchool").value=s.name;document.querySelector("#otherSchool").required=true;}}
}).catch(()=>{const option=document.createElement("option");option.value="other";option.textContent="其他学校";schoolSelect.append(option);schoolSelect.value="other";other.hidden=false;document.querySelector("#otherSchool").required=true;toast("大学库加载失败，可手动填写学校。");});
function render(data){
 const labels={story:"故事性",structure:"结构",voice:"个人特色",language:"语言表达",promptFit:"题目匹配"};
 const list=arr=>'<ul>'+arr.map(s=>'<li>'+h(s)+'</li>').join("")+'</ul>';
 results.innerHTML='<section class="card feedback-card"><p class="eyebrow">YOUR WRITING, A CLEARER VIEW</p><h2>总体评价</h2><p>'+h(data.summary)+'</p><p class="score-note">评分仅作写作反馈参考，不代表录取机会。</p>'+Object.entries(labels).map(([key,label])=>'<div class="score-row"><span>'+label+'</span><div class="metric-track"><span style="width:'+(Number.isFinite(data.scores[key])?data.scores[key]:0)+'%"></span></div><strong>'+(data.scores[key]===null?"未提供题目":h(data.scores[key])+'/100')+'</strong></div>').join("")+'</section><section class="card feedback-card"><h2>做得好的地方</h2>'+list(data.strengths)+'</section><section class="card feedback-card"><h2>需要改进</h2>'+data.issues.map(i=>'<div class="feedback-issue"><h3>'+h(i.title)+'</h3><p>'+h(i.detail)+'</p></div>').join("")+'</section><section class="card feedback-card"><h2>具体建议</h2>'+list(data.suggestions)+'</section><section class="card feedback-card"><details><summary>AI 修改稿 · 点击展开</summary><p class="privacy-note">供你参考，请核实事实并保留自己的声音。原文不会被覆盖。</p><div class="revised-draft">'+h(data.revisedDraft||"本次没有生成修改稿。")+'</div>'+(data.revisedDraft?'<button class="button secondary" id="copyDraft" type="button">复制修改稿</button>':"")+'</details></section>';
 document.querySelector("#copyDraft")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(data.revisedDraft);toast("复制成功");}catch{toast("复制失败，请展开修改稿后手动选择复制。");}});
}
form.addEventListener("submit",async event=>{
 event.preventDefault();if(submitting)return;
 const body={school:schoolSelect.value==="other"?document.querySelector("#otherSchool").value.trim():schoolSelect.value,essayType:document.querySelector("#essayType").value,prompt:document.querySelector("#essayPrompt").value,essayText:input.value};
 if(!body.school||!body.essayText.trim()||body.essayText.length>12000||body.prompt.length>3000){status.hidden=false;status.textContent="请填写目标学校与文书，并检查字数限制。";return;}
 submitting=true;button.disabled=true;button.textContent="分析中…";status.hidden=true;
 results.innerHTML='<div class="card essay-loading" role="status"><div class="reading-orbit" aria-hidden="true"></div><strong>AI 正在阅读你的文书…</strong><p id="readingStage">正在梳理结构…</p></div>';
 const stages=["正在梳理结构…","正在检查主题一致性…","正在整理修改建议…"];let stage=0;
 const interval=setInterval(()=>{document.querySelector("#readingStage").textContent=stages[++stage%stages.length];},2600);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
 try{
   const response=await fetch("/api/essay/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
   if(!response.ok)throw new Error(({400:"请检查文书和题目的长度与填写内容。",429:"分析过于频繁，请稍后再试。",503:"AI 文书分析暂时不可用，请稍后重试。",415:"请求格式有误，请刷新页面重试。"}[response.status])||"分析暂时失败，请稍后重试。");
   const data=await response.json();
   render(data);
 }catch(error){
   results.innerHTML='<div class="empty-state"><span class="empty-mark" aria-hidden="true">✎</span><h2>这次分析没有完成</h2><p>你的原文仍在左侧，可稍后重新提交。</p></div>';
   status.textContent=error.name==="AbortError"?"分析超时，请稍后重试。":error instanceof TypeError?"网络异常，请稍后重试。":["请检查文书和题目的长度与填写内容。","分析过于频繁，请稍后再试。","AI 文书分析暂时不可用，请稍后重试。"].includes(error.message)?error.message:"分析暂时失败，请稍后重试。";
   status.hidden=false;toast("分析失败");
 }finally{clearInterval(interval);clearTimeout(timer);submitting=false;button.disabled=false;button.textContent="AI 分析文书";}
});

