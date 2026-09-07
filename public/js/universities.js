import { mountSite,getUniversities,escapeHtml,emptyState } from "./shared.js";
mountSite("universities");
const grid=document.querySelector("#universityGrid"), input=document.querySelector("#universitySearch"), filters=document.querySelector("#regionFilters"), count=document.querySelector("#resultCount");
let schools=[],region="all";
const countries={"United States":"美国","United Kingdom":"英国","Switzerland":"瑞士","Singapore":"新加坡","Hong Kong SAR":"中国香港","China":"中国"};
function render(){
  const q=input.value.trim().toLowerCase();
  const list=schools.filter(s=>(region==="all"||s.region===region)&&[s.name,s.shortName,...s.aliases].some(n=>n.toLowerCase().includes(q)));
  count.textContent="显示 "+list.length+" 所大学";
  grid.innerHTML=list.length?list.map(s=>'<article class="card university-card"><div class="uni-card-top"><span class="school-emblem">'+escapeHtml(s.shortName.length<5?s.shortName:s.shortName.slice(0,2).toUpperCase())+'</span><span class="rank">QS #'+s.rank+'</span></div><h2>'+escapeHtml(s.shortName)+'</h2><p class="uni-full-name">'+escapeHtml(s.name)+'</p><p class="muted">'+countries[s.country]+' · '+escapeHtml(s.city)+'</p><a class="university-link" href="/university.html?id='+s.id+'">查看申请工作台 →</a></article>').join(""):emptyState("没有匹配的大学","试试其他名称或切换地区。","/universities.html","重置筛选");
}
filters.addEventListener("click",e=>{const b=e.target.closest("button[data-region]");if(!b)return;region=b.dataset.region;for(const btn of filters.querySelectorAll("button"))btn.setAttribute("aria-pressed",String(btn===b));render();});
input.addEventListener("input",render);
getUniversities().then(data=>{schools=data;render();}).catch(e=>{grid.innerHTML=emptyState("大学库暂时无法加载",e.message);});

