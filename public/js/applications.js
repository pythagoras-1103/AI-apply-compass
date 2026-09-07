import { mountSite,getUniversities,escapeHtml as h,schoolLink,toast,emptyState } from "./shared.js";
import { createApplicationStore,progress,timelineItems,todayDate } from "./storage.js";
mountSite("applications");
const grid=document.querySelector("#applicationGrid"),dialog=document.querySelector("#removeDialog");
let store,removing;
function render(){
 const schools=store.getApplications();document.querySelector("#applicationCount").textContent=schools.length+" 所目标学校";
 grid.innerHTML=schools.length?schools.map(s=>{
   const record=store.getMaterials(s.name),p=progress(record),nearest=timelineItems(record?.items).find(i=>i.deadline>=todayDate());
   return '<article class="card application-card"><div class="application-top"><div><span class="rank">'+(s.rank?"QS #"+s.rank:"我的目标学校")+'</span><h2>'+h(s.shortName)+'</h2></div><button type="button" class="text-button remove-button" data-remove="'+h(s.id)+'" aria-label="移除 '+h(s.shortName)+'">移除</button></div>'+
   (record?'<div class="application-progress"><span>材料完成 '+p.completed+' / '+p.total+'</span><strong>'+p.percentage+'%</strong></div><div class="metric-track"><span style="width:'+p.percentage+'%"></span></div><p class="next-deadline">最近 Deadline <strong>'+ (nearest?h(nearest.deadline):"暂无未来日期")+'</strong></p><small class="muted">'+(record.source==="fallback"?"本地备用清单 · 请核对官网":"本机保存的 AI 结果")+'</small>':'<p class="no-materials">尚未生成材料清单</p>')+
   '<div class="actions"><a class="button" href="'+schoolLink("materials",s.name)+'">'+(record?"继续准备 →":"开始查询")+'</a><a class="text-button" href="'+schoolLink("timeline",s.id)+'">查看时间线</a></div></article>';
 }).join(""):emptyState("还没有目标学校。","从大学库找到感兴趣的学校，加入后便可在这里集中查看准备进度。");
}
grid.addEventListener("click",e=>{const b=e.target.closest("[data-remove]");if(!b)return;removing=store.getApplications().find(s=>s.id===b.dataset.remove);document.querySelector("#removeName").textContent=removing.shortName;dialog.showModal();});
document.querySelector("#confirmRemove").addEventListener("click",()=>{if(removing&&store.remove(removing.name)){toast("已移除");render();}dialog.close();});
document.querySelector("#cancelRemove").addEventListener("click",()=>dialog.close());
getUniversities().then(s=>{store=createApplicationStore(localStorage,s,()=>toast("本地存储不可用，进度可能无法保存。"));render();window.addEventListener("storage",render);}).catch(()=>{grid.innerHTML=emptyState("暂时无法读取申请","请刷新重试。");});
