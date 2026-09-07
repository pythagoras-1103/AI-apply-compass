import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createApplicationStore, itemKey, resolveSchool } from "../public/js/storage.js";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8").replace(/^import .*;$/gm, "");
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function element() {
  const classes = new Set();
  return { textContent: "", innerHTML: "", value: "", hidden: false, disabled: false, dataset: {},
    listeners: {}, attributes: {}, style: { setProperty() {} },
    classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }, contains: (name) => classes.has(name) },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
}

async function page() {
  const nodes = new Map();
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const tabs = ["NYU", "UCL", "港大"].map((school) => ({ ...element(), dataset: { school } }));
  get("#schoolTabs").querySelectorAll = () => tabs;
  get("#materialsList").querySelector = (selector) => {
    const row = get(selector);
    row.querySelector = () => get(selector + "-button");
    return row;
  };
  const requests = [];
  let timerId = 0;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-09-07T12:00:00"])); }
  }
  const context = vm.createContext({ document: { querySelector: get }, URL, URLSearchParams, AbortController,
    mountSite() {}, getUniversities: async () => [], toast() {}, schoolLink: (page, school) => page + "?school=" + encodeURIComponent(school),
    createApplicationStore, itemKey, resolveSchool, location: { search: "" }, localStorage: { values: new Map(), getItem(key) {return this.values.get(key) || null;}, setItem(key,value) {this.values.set(key,value);} },
    Date: FixedDate, setTimeout: () => ++timerId, clearTimeout() {}, console,
    fetch: (url, options) => new Promise((resolve, reject) => { requests.push({ url, options, resolve, reject }); })
  });
  vm.runInContext(source, context);
  await settle();
  const run = (code) => vm.runInContext(code, context);
  const respond = (index, data, status = 200) => requests[index].resolve({ ok: status === 200, status, json: async () => data });
  return { get, tabs, requests, run, respond };
}

test("frontend ignores late responses, aborts previous requests and retains latest title/items", async () => {
  const p = await page();
  const latest = p.run('loadMaterials("UCL")');
  assert.equal(p.requests[0].options.signal.aborted, true);
  p.respond(1, { source: "kimi", items: [{ name: "UCL only" }] });
  await latest;
  p.respond(0, { source: "fallback", items: [{ name: "NYU stale" }] });
  await settle();
  assert.equal(p.get("#schoolTitle").textContent, "UCL 本科申请材料");
  assert.ok(p.get("#materialsList").innerHTML.includes("UCL only"));
  assert.ok(!p.get("#materialsList").innerHTML.includes("NYU stale"));
  assert.equal(p.get("#searchButton").disabled, false);
});

test("empty and duplicate searches are blocked; custom search clears shortcut active state", async () => {
  const p = await page();
  p.get("#schoolInput").value = "MIT";
  p.get("#schoolSearch").listeners.submit({ preventDefault() {} });
  assert.equal(p.requests.length, 1);
  p.respond(0, { source: "fallback", items: [] });
  await settle();
  p.get("#schoolInput").value = "   ";
  p.get("#schoolSearch").listeners.submit({ preventDefault() {} });
  assert.equal(p.requests.length, 1);
  p.get("#schoolInput").value = "MIT";
  p.get("#schoolSearch").listeners.submit({ preventDefault() {} });
  assert.equal(p.requests.length, 2);
  assert.ok(p.tabs.every((tab) => !tab.classList.contains("active")));
  assert.equal(p.get("#searchButton").disabled, true);
  p.respond(1, { source: "unavailable", items: [] });
  await settle();
  assert.equal(p.get("#schoolTitle").textContent, "MIT 本科申请材料");
  assert.equal(p.get("#progressBlock").hidden, true);
  assert.ok(p.get("#queryNotice").textContent.includes("没有该学校"));
});

test("source badges distinguish cache and fallback; rate-limit errors are friendly", async () => {
  const p = await page();
  p.respond(0, { source: "cache", items: [{ name: "Essay" }] });
  await settle();
  assert.equal(p.get("#sourceBadge").textContent, "AI 查询结果 · 缓存");
  const fallback = p.run('loadMaterials("UCL", false, true)');
  p.respond(1, { source: "fallback", items: [{ name: "Essay" }] });
  await fallback;
  assert.equal(p.get("#queryNotice").textContent, "本地备用清单 · 请以学校官网最新要求为准");
  const limited = p.run('loadMaterials("NYU", false, true)');
  p.respond(2, {}, 429);
  await limited;
  assert.equal(p.get("#queryNotice").textContent, "查询过于频繁，请稍后再试。");
  assert.equal(p.get("#loadingBox").hidden, true);
});

test("malformed response errors never render response body details", async () => {
  const p = await page();
  p.requests[0].resolve({ ok: true, json: async () => { throw new SyntaxError("private upstream body"); } });
  await settle();
  assert.equal(p.get("#queryNotice").textContent, "AI 查询暂时失败，请稍后重试。");
});

test("HTML is escaped, source links are safe and link clicks do not toggle materials", async () => {
  const p = await page();
  p.respond(0, { source: "kimi", items: [{ name: '<img src=x onerror="evil()">', sourceUrl: 'https://example.org/?a=1&b=2', sourceTitle: '" title', verifiedAt: "2026-09-07" }, { name: "Other", sourceUrl: "javascript:evil()" }] });
  await settle();
  const html = p.get("#materialsList").innerHTML;
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));
  assert.ok(!html.includes("javascript:"));
  p.get("#materialsList").listeners.click({ target: { closest: (selector) => selector === "a" ? {} : null } });
  assert.equal(p.get("#progressPercent").textContent, "0%");
  p.get("#materialsList").listeners.click({ target: { closest: (selector) => selector === "a" ? null : { dataset: { index: "0" } } } });
  assert.equal(p.get("#progressPercent").textContent, "50%");
  p.run("toggleMaterial(1)");
  assert.equal(p.get("#progressPercent").textContent, "100%");
  assert.equal(p.get("#celebration").hidden, false);
  p.run("toggleMaterial(1)");
  assert.equal(p.get("#celebration").hidden, true);
});

test("deadline thresholds include today, overdue, seven and twenty-one days", async () => {
  const p = await page();
  assert.equal(p.run('getDeadlineBadge("").level'), "unknown");
  assert.equal(p.run('getDeadlineBadge("2026-09-06").label'), "已过 1 天");
  assert.equal(p.run('getDeadlineBadge("2026-09-07").label'), "还剩 0 天");
  assert.equal(p.run('getDeadlineBadge("2026-09-14").level'), "danger");
  assert.equal(p.run('getDeadlineBadge("2026-09-15").level'), "warning");
  assert.equal(p.run('getDeadlineBadge("2026-09-28").level'), "warning");
  assert.equal(p.run('getDeadlineBadge("2026-09-29").level'), "normal");
});

test("saved checklist restores completion without another request and survives failed refresh", async () => {
  const p = await page();
  p.respond(0, {source:"kimi",items:[{name:"Essay",deadline:"2026-11-01"}]});
  await settle();
  p.run("toggleMaterial(0)");
  await p.run('loadMaterials("NYU")');
  assert.equal(p.requests.length,1);
  assert.equal(p.get("#progressPercent").textContent,"100%");
  assert.ok(p.get("#sourceBadge").textContent.includes("本机保存"));
  const refresh = p.run('loadMaterials("NYU",false,true)');
  p.respond(1,{source:"unavailable",items:[]});
  await refresh;
  assert.equal(p.get("#progressPercent").textContent,"100%");
  assert.ok(p.get("#materialsList").innerHTML.includes("Essay"));
  assert.ok(p.get("#queryNotice").textContent.includes("保留原有"));
});

