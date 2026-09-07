import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createApplicationStore,resolveSchool,progress,itemKey,timelineItems,deadlineState} from "../public/js/storage.js";
const schools=JSON.parse(readFileSync(new URL("../public/data/qsTop15.json",import.meta.url),"utf8"));
const memory=()=>({data:new Map(),getItem(key){return this.data.get(key)||null;},setItem(key,value){this.data.set(key,value);}});
test("QS 2027 has exactly 15 unique schools and preserves tied ranks without dynamic admissions claims",()=>{
 assert.equal(schools.length,15);assert.equal(new Set(schools.map(s=>s.id)).size,15);
 assert.equal(schools.find(s=>s.id==="imperial").rank,"=2");assert.equal(schools.find(s=>s.id==="stanford").rank,"=2");
 for(const s of schools){for(const key of ["deadline","tuition","acceptanceRate","sat"])assert.equal(s[key],undefined);assert.ok(s.name&&s.region&&s.slug);}
});
test("school identity joins IDs, full names, shortcuts, and custom school links",()=>{
 for(const name of ["mit","MIT","Massachusetts Institute of Technology","Massachusetts Institute of Technology (MIT)"])assert.equal(resolveSchool(name,schools).id,"mit");
 assert.equal(resolveSchool("港大",schools).id,"hku");
 assert.equal(resolveSchool("UCL",schools).id,"ucl");
 const custom=resolveSchool("University of Sydney",schools);
 assert.equal(resolveSchool(custom.id,schools).id,custom.id);
 assert.notEqual(resolveSchool("Harvard",schools).id,resolveSchool("NYU",schools).id);
});
test("applications and material completion persist across store recreation; remove retains checklist",()=>{
 const storage=memory(),store=createApplicationStore(storage,schools);
 store.add("MIT");store.add("mit");
 assert.equal(store.getApplications().length,1);
 const items=[{name:"Essay",description:"Write your story",deadline:"2027-01-05"},{name:"Transcript",deadline:""}];
 store.saveMaterials("MIT",{source:"kimi",items,apiKey:"must-not-save",essayText:"must-not-save"});
 store.saveChecked("mit",[itemKey(items[0])]);
 const reloaded=createApplicationStore(storage,schools);
 assert.deepEqual(progress(reloaded.getMaterials("Massachusetts Institute of Technology")),{completed:1,total:2,percentage:50});
 assert.equal(reloaded.getApplications()[0].id,"mit");
 assert.ok(![...storage.data.values()].join("").includes("must-not-save"));
 reloaded.remove("MIT");assert.equal(reloaded.getApplications().length,0);
 assert.equal(reloaded.getMaterials("mit").checked.length,1);
});
test("failed/fallback queries cannot overwrite AI results; changed requirements reset only changed completions",()=>{
 const store=createApplicationStore(memory(),schools),item={name:"Essay",description:"A",deadline:"2027-01-01"};
 store.saveMaterials("MIT",{source:"kimi",items:[item]});store.saveChecked("MIT",[itemKey(item)]);
 assert.equal(store.saveMaterials("MIT",{source:"unavailable",items:[]}),false);
 assert.equal(store.saveMaterials("MIT",{source:"fallback",items:[{name:"generic"}]}),false);
 assert.equal(store.getMaterials("MIT").source,"kimi");
 store.saveMaterials("MIT",{source:"cache",items:[{...item,description:"B"}]});
 assert.equal(progress(store.getMaterials("MIT")).completed,0);
});
test("timeline filters invalid calendar dates, sorts valid records and labels overdue",()=>{
 const items=[{name:"later",deadline:"2027-02-01"},{name:"earlier",deadline:"2026-11-01"},{name:"empty",deadline:""},{name:"bad",deadline:"2026-02-30"},null];
 assert.deepEqual(timelineItems(items).map(i=>i.name),["earlier","later"]);
 assert.equal(deadlineState("2026-01-01","2026-09-07").label,"已截止");
 assert.equal(deadlineState("2026-09-07","2026-09-07").label,"今天截止");
 assert.equal(items[0].name,"later");
});
test("corrupt and blocked localStorage fail safely",()=>{
 let errors=0;const storage=memory();storage.setItem("applyCompass.applications","broken");
 const store=createApplicationStore(storage,schools,()=>errors++);
 assert.deepEqual(store.getApplications(),[]);assert.equal(errors,1);
 const blocked=createApplicationStore({getItem(){throw new Error();},setItem(){throw new Error();}},schools,()=>errors++);
 assert.equal(blocked.add("MIT"),false);
 assert.equal(blocked.getMaterials("MIT"),null);
});

