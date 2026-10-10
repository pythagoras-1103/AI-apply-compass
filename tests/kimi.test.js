import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchKimiChecklist, searchTarget, kimiFailureReason, evidenceHasDate} from '../src/kimiClient.js';
const source='https://college.harvard.edu/admissions/apply';
const evidence={search_results:[{title:'Apply',url:source,chunks:[{text:'First-year applicants submit an application and school report.'}]}]};
const final=content=>({choices:[{finish_reason:'stop',message:{role:'assistant',content}}]});
const json=body=>({ok:true,json:async()=>body});
const opts={apiKey:'test-only',now:()=>new Date('2026-10-10T00:00:00Z')};
const good=JSON.stringify({items:[{name:'Application',sourceUrl:source}]});
test('Chinese university alias resolves to official search domain',()=>{
 assert.deepEqual(searchTarget('哈佛大学'),{name:'Harvard University',domain:'college.harvard.edu'});
 assert.equal(searchTarget('NYU').domain,'nyu.edu');
 assert.deepEqual(searchTarget('Unknown University'),{name:'Unknown University'});
});
test('search executes before JSON generation and only supplied sources survive',async()=>{
 const calls=[];
 const items=await fetchKimiChecklist('哈佛大学',{...opts,fetchImpl:async(url,r)=>{
  const body=JSON.parse(r.body);calls.push({url,body});
  return json(calls.length===1?evidence:final(JSON.stringify({items:[{name:'Application',sourceUrl:source},{name:'invented',sourceUrl:'https://evil.example'}]})));
 }});
 assert.equal(items.length,1);assert.equal(items[0].verifiedAt,'2026-10-10');
 assert.match(calls[0].url,/tools\/search_pro$/);assert.deepEqual(calls[0].body.sites,['college.harvard.edu']);
 assert.deepEqual(calls[1].body.response_format,{type:'json_object'});assert.equal(calls[1].body.tools,undefined);
});
test('no official body never invokes model',async()=>{
 let calls=0;await assert.rejects(fetchKimiChecklist('哈佛大学',{...opts,fetchImpl:async()=>{calls++;return json({search_results:[{url:'https://harvard.edu.evil.example',chunks:[{text:'fake'}]}]});}}),/No search evidence/);assert.equal(calls,1);
});
test('format recovery is bounded to one extra generation',async()=>{
 let calls=0;const items=await fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>json(++calls===1?evidence:final(calls===2?'not json':good))});assert.equal(calls,3);assert.equal(items.length,1);
 let badCalls=0;await assert.rejects(fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>json(++badCalls===1?evidence:final('not json'))}),/Cannot parse/);assert.equal(badCalls,3);
});
test('empty results are not replaced by guessed requirements',async()=>{
 let calls=0;await assert.rejects(fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>json(++calls===1?evidence:final('{"items":[]}'))}),/No usable/);assert.equal(calls,2);
});
test('authentication failure has no paid retry and is sanitized',async()=>{
 let calls=0;await assert.rejects(fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>{calls++;return {ok:false,status:401};}}),/Kimi search HTTP 401/);assert.equal(calls,1);
 assert.equal(kimiFailureReason(new Error('Kimi search HTTP 401')),'Kimi search HTTP 401');
 assert.equal(kimiFailureReason(new Error('private token')),'upstream_or_network_error');
});
test('timeout covers response body read',async()=>{
 await assert.rejects(fetchKimiChecklist('Harvard',{...opts,timeoutMs:10,fetchImpl:async(_u,{signal})=>({ok:true,json:()=>new Promise((_res,rej)=>signal.addEventListener('abort',()=>rej(signal.reason),{once:true}))})}),/timed out/);
});
test('truncated generation is rejected',async()=>{
 let calls=0;await assert.rejects(fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>json(++calls===1?evidence:{choices:[{finish_reason:'length',message:{content:good}}]})}),/Incomplete/);
});

test('transient search gateway failure retries once but never indefinitely',async()=>{
 let calls=0;const items=await fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>{calls++;return calls===1?{ok:false,status:502}:json(calls===2?evidence:final(good));}});assert.equal(calls,3);assert.equal(items.length,1);
 let failed=0;await assert.rejects(fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>{failed++;return {ok:false,status:502};}}),/502/);assert.equal(failed,2);
});

test('deadline needs explicit complete year/month/day in source, not inferred recurring dates',()=>{
 assert.equal(evidenceHasDate('2026-11-01','November 1 is our annual deadline'),false);
 assert.equal(evidenceHasDate('2026-11-01','November 1, 2026'),true);
 assert.equal(evidenceHasDate('2027-01-01','2027-01-01'),true);
 assert.equal(evidenceHasDate('2027-01-01','January 1, 2026'),false);
});
test('MIT retrieves its known official undergraduate admissions page, never department/MBA pages',async()=>{
 const calls=[];const url='https://catalog.mit.edu/mit/undergraduate-education/admissions/';
 const items=await fetchKimiChecklist('MIT',{...opts,fetchImpl:async(endpoint)=>{calls.push(endpoint);return json(calls.length===1?{url,title:'MIT Admissions',markdown:'First-year students submit an application.'}:final(JSON.stringify({items:[{name:'Application',sourceUrl:url}]})));}});
 assert.match(calls[0],/tools\/fetch$/);assert.equal(items.length,1);assert.equal(items[0].sourceTitle,'MIT Admissions');
});
test('past dates and unsupported model-inferred dates are cleared',async()=>{
 let calls=0;const items=await fetchKimiChecklist('Harvard',{...opts,fetchImpl:async()=>json(++calls===1?{search_results:[{title:'Apply',url:source,chunks:[{text:'Deadline January 1, 2026. Annual application information.'}]}]}:final(JSON.stringify({items:[{name:'Past',deadline:'2026-01-01',sourceUrl:source},{name:'Inferred',deadline:'2027-01-01',sourceUrl:source}]})))});
 assert.deepEqual(items.map(i=>i.deadline),['','']);
});
