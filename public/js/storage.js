export const normalize = value => String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
export function resolveSchool(value, catalogue = []) {
  const key = normalize(value);
  const found = catalogue.find(s => [s.id, s.name, s.shortName, ...(s.aliases || [])].some(v => normalize(v) === key));
  if (found) return found;
  if (key.startsWith("custom-")) {
    try { const name = decodeURIComponent(String(value).slice(7)); return {id:"custom-"+encodeURIComponent(normalize(name)),name,shortName:name,rank:""}; } catch { /* Treat invalid encoding as a literal name. */ }
  }
  if (["nyu", "new york university", "纽约大学"].includes(key)) return { id: "nyu", name: "NYU", shortName: "NYU", rank: "", country: "United States", city: "New York" };
  const name = String(value || "").trim().slice(0,120);
  return { id: "custom-" + encodeURIComponent(key), name, shortName: name, rank: "" };
}
export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value ? value : "";
}
export function timelineItems(items) {
  return (Array.isArray(items) ? items : []).filter(i => i && typeof i.name === "string" && validDate(i.deadline)).map(i => ({...i})).sort((a,b) => a.deadline.localeCompare(b.deadline));
}
export function todayDate(date = new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
}
export function deadlineState(deadline, today = todayDate()) {
  if (!validDate(deadline)) return null;
  const days = Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000);
  return {days, status:days<0?"past":days<=21?"near":"future", label:days<0?"已截止":days===0?"今天截止":days<=21?"临近 · 还剩 "+days+" 天":"未来 · 还剩 "+days+" 天"};
}
export const itemKey = item => JSON.stringify([item.name || "", item.description || "", item.deadline || ""]);
export function progress(record) {
  const items = record?.items || [];
  const done = new Set(record?.checked || []);
  const completed = items.filter(i=>done.has(itemKey(i))).length;
  return {completed,total:items.length,percentage:items.length?Math.round(completed/items.length*100):0};
}
// Only whitelisted material fields and completion IDs are stored. Essays never enter this store.
export function createApplicationStore(storage, catalogue = [], onError = () => {}) {
  const read = (key, fallback) => {try {const raw=storage.getItem(key);return raw ? JSON.parse(raw) : fallback;} catch {onError();return fallback;}};
  const write = (key, data) => {try {storage.setItem(key,JSON.stringify(data));return true;} catch {onError();return false;}};
  const key = school => "applyCompass.school." + resolveSchool(school,catalogue).id + ".materials";
  const getApplications = () => {
    const data=read("applyCompass.applications",[]);
    return Array.isArray(data)?data.filter(s=>s && typeof s.name==="string" && s.name.trim()).slice(0,100).map(s=>resolveSchool(s.name,catalogue)):[];
  };
  const getMaterials = school => {
    const data=read(key(school),null);
    if (!data || !["kimi","cache","fallback"].includes(data.source) || !Array.isArray(data.items)) return null;
    return {...data, items:data.items.filter(i=>i && typeof i.name==="string").slice(0,40),checked:Array.isArray(data.checked)?data.checked.filter(v=>typeof v==="string"):[]};
  };
  return {
    getApplications, getMaterials,
    add(school) {
      const entry=resolveSchool(school,catalogue); const all=getApplications();
      if (!entry.name) return false;
      if (all.some(s=>s.id===entry.id)) return true;
      if(all.length>=100){onError();return false;}
      return write("applyCompass.applications",[...all,entry]);
    },
    remove(school) {
      const id=resolveSchool(school,catalogue).id;
      return write("applyCompass.applications",getApplications().filter(s=>s.id!==id));
    },
    saveMaterials(school, data) {
      if (!["kimi","cache","fallback"].includes(data.source) || !Array.isArray(data.items) || !data.items.length) return false;
      const old=getMaterials(school);
      // An unavailable search or fallback cannot erase a previously saved AI result.
      if(data.source==="fallback" && old && old.source!=="fallback") return false;
      const items=data.items.filter(i=>i && typeof i.name==="string" && i.name.trim()).slice(0,40).map(i=>Object.fromEntries(["name","description","deadline","sourceTitle","sourceUrl","verifiedAt"].map(k=>[k,typeof i[k]==="string"?i[k].trim():""])));
      const ids=new Set(items.map(itemKey));
      return write(key(school),{school:resolveSchool(school,catalogue).name,items,source:data.source,queriedAt:new Date().toISOString(),checked:(old?.checked||[]).filter(id=>ids.has(id))});
    },
    saveChecked(school, checked) {
      const record=getMaterials(school); if(!record) return false;
      const ids=new Set(record.items.map(itemKey));
      return write(key(school),{...record,checked:[...checked].filter(id=>ids.has(id))});
    }
  };
}
