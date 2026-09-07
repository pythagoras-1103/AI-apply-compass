import { mountSite,getUniversities,escapeHtml as h,schoolLink,toast,emptyState } from "./shared.js";
import { createApplicationStore } from "./storage.js";
mountSite("universities");
const main=document.querySelector("#universityContent");
getUniversities().then(schools=>{
  const school=schools.find(s=>s.id===new URLSearchParams(location.search).get("id"));
  if(!school){main.innerHTML=emptyState("没有找到这所大学","请从大学库选择目标学校。");return;}
  const store=createApplicationStore(localStorage,schools,()=>toast("本地保存不可用，请检查浏览器存储设置。"));
  const materials=schoolLink("materials",school.name),timeline=schoolLink("timeline",school.id),essay=schoolLink("essay",school.id);
  main.innerHTML='<div class="breadcrumbs"><a href="/universities.html">大学库</a> / '+h(school.shortName)+'</div><section class="university-hero card"><div><span class="pill">QS #'+school.rank+' · 2027</span><h1>'+h(school.name)+'</h1><p class="lead">'+h(school.shortName)+' <span> / </span> '+h(school.country)+' · '+h(school.city)+'</p><div class="actions"><button class="button" id="addApplication" type="button">加入我的申请</button><a class="button secondary" href="'+materials+'">生成申请清单 →</a></div></div><div class="school-emblem big-emblem">'+h(school.shortName.length<5?school.shortName:school.shortName.slice(0,2).toUpperCase())+'</div></section><nav class="workspace-tabs" aria-label="申请工作台"><a aria-current="page" href="#overview">01 申请概览</a><a href="'+materials+'">02 申请材料</a><a href="'+timeline+'">03 申请时间线</a><a href="'+essay+'">04 AI 文书</a></nav><section class="card overview" id="overview"><div><p class="eyebrow">A CLEAR START</p><h2>先了解，再开始准备。</h2><p class="lead">申请要求由 Kimi 联网检索官方来源生成。<br>从一份有来源的材料清单开始，逐步建立你的申请计划。</p><div class="actions"><a class="button" href="'+materials+'">查询申请材料</a><a class="button secondary" href="'+timeline+'">开始规划</a><a class="text-button" href="'+essay+'">分析文书 →</a></div></div><dl class="school-facts"><div><dt>QS World University Rankings 2027</dt><dd>#'+school.rank+'</dd></div><div><dt>地区</dt><dd>'+h(school.country)+'</dd></div><div><dt>学校名称</dt><dd>'+h(school.name)+'</dd></div></dl></section>';
  const button=document.querySelector("#addApplication");
  const update=()=>{const added=store.getApplications().some(s=>s.id===school.id);button.textContent=added?"已加入我的申请 ✓":"加入我的申请";button.disabled=added;};
  button.addEventListener("click",()=>{if(store.add(school.name)){toast("已加入我的申请");update();}});
  update();
}).catch(()=>{main.innerHTML=emptyState("大学信息暂时无法加载","请刷新后重试。");});

