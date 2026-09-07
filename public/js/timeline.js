import { mountSite,getUniversities,escapeHtml as h,schoolLink,emptyState,toast } from "./shared.js";
import { createApplicationStore,resolveSchool,timelineItems,todayDate,deadlineState } from "./storage.js";
mountSite("applications");
const body=document.querySelector("#timelineContent");
getUniversities().then(schools=>{
 const raw=new URLSearchParams(location.search).get("school");
 if(!raw){body.innerHTML=emptyState("先选择一所目标学校","在“我的申请”中打开学校时间线，查看材料清单里的截止日期。","/applications.html","我的申请 →");return;}
 const s=resolveSchool(raw,schools),store=createApplicationStore(localStorage,schools,()=>toast("无法读取本地数据，请检查浏览器存储设置。")),record=store.getMaterials(s.name);
 document.querySelector("#timelineSchool").textContent=s.shortName+" · 申请时间线";
 if(!record){body.innerHTML=emptyState("还没有可用 Deadline。","请先生成该校申请材料，系统才能从官方结果中整理时间线。",schoolLink("materials",s.name),"生成申请清单 →");return;}
 const items=timelineItems(record.items),today=todayDate();
 if(!items.length){body.innerHTML=emptyState("还没有可用 Deadline。","已保存材料中没有可确认的截止日期，未确认或无效日期不会进入时间线。",schoolLink("materials",s.name),"返回申请材料 →");return;}
 const next=items.find(i=>i.deadline>=today)?.deadline;
 const nodes=[...items.map(i=>({...i,isToday:false})),{name:"📍 今天",deadline:today,isToday:true}].sort((a,b)=>a.deadline.localeCompare(b.deadline)||(a.isToday?-1:1));
 body.innerHTML='<p class="notice">'+(record.source==="fallback"?"本地备用清单 · 请以学校官网最新要求为准":"来自本机保存的 Kimi 材料查询结果 · 请核对学校官方要求")+'<br>查询时间：'+h(record.queriedAt||"未知")+'</p><div class="timeline-scroll" tabindex="0" role="region" aria-label="按日期排序的申请节点，可横向滚动"><ol class="timeline">'+nodes.map(i=>{
 const state=deadlineState(i.deadline,today);
 return '<li class="'+(i.isToday?"today":state.status)+(i.deadline===next&&!i.isToday?" nearest":"")+'"><span class="timeline-dot" aria-hidden="true"></span><time datetime="'+i.deadline+'">'+i.deadline+'</time><h2>'+h(i.name)+'</h2><span class="timeline-state">'+(i.isToday?"规划从今天开始":state.label)+'</span>'+(!i.isToday?'<p>'+h(i.description||"请核对材料要求")+'</p>':"")+'</li>';
 }).join("")+'</ol></div><div class="actions"><a class="button secondary" href="'+schoolLink("materials",s.name)+'">返回申请材料</a><a class="text-button" href="/applications.html">我的申请 →</a></div>';
}).catch(()=>{body.innerHTML=emptyState("时间线暂时无法加载","请刷新重试。");});

