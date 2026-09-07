import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/server.js";
import { ChecklistCache } from "../src/cache.js";

async function serve(t, options) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, options) => fetch(base + path, options);
}

test("health and static files work; invalid input never invokes AI", async (t) => {
  let calls = 0;
  const request = await serve(t, { queryKimi: async () => { calls++; return []; } });
  assert.deepEqual(await (await request("/healthz")).json(), { ok: true });
  assert.equal((await request("/")).status, 200);
  for (const query of ["", "?school=", "?school=%20", "?school=a&school=b", "?school[x]=a", "?school=" + "x".repeat(121), "?school=%3Cscript%3E"]) {
    const response = await request("/api/materials" + query);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "请输入有效的学校名称" });
  }
  assert.equal(calls, 0);
});

test("failures return correct fallback/unavailable without exposing upstream details or caching", async (t) => {
  let calls = 0;
  const request = await serve(t, { queryKimi: async () => { calls++; throw new Error("sensitive upstream detail"); } });
  for (const school of ["NYU", "Harvard", "Harvard", "NYU"]) {
    const response = await request("/api/materials?school=" + school);
    const data = await response.json();
    assert.equal(data.school, school);
    assert.equal(data.source, school === "NYU" ? "fallback" : "unavailable");
    assert.equal(data.items.length, school === "NYU" ? 5 : 0);
    assert.ok(!JSON.stringify(data).includes("sensitive"));
    assert.ok(data.warning);
  }
  assert.equal(calls, 4);
});

test("success caches normalized names and queries again at TTL", async (t) => {
  let time = 0;
  let calls = 0;
  const request = await serve(t, { cache: new ChecklistCache({ now: () => time }), queryKimi: async () => { calls++; return [{ name: "Essay" }]; } });
  assert.equal((await (await request("/api/materials?school=NYU")).json()).source, "kimi");
  assert.equal((await (await request("/api/materials?school=%20nyu%20")).json()).source, "cache");
  assert.equal(calls, 1);
  time = 600000;
  assert.equal((await (await request("/api/materials?school=NYU")).json()).source, "kimi");
  assert.equal(calls, 2);
});

test("rate limit gives JSON 429 while static files and health remain accessible", async (t) => {
  const request = await serve(t, { rateLimitMax: 2, queryKimi: async () => [{ name: "Essay" }] });
  await request("/api/materials?school=NYU");
  await request("/api/materials?school=NYU");
  const response = await request("/api/materials?school=NYU");
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: "查询过于频繁，请稍后再试。" });
  assert.ok(response.headers.get("retry-after"));
  for (const path of ["/", "/styles.css", "/app.js", "/healthz"]) assert.equal((await request(path)).status, 200);
});

test("concurrent identical schools share one request; distinct overflow is rejected", async (t) => {
  let release;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  const request = await serve(t, { maxConcurrent: 1, queryKimi: async () => {
    calls++;
    started();
    return new Promise((resolve) => { release = () => resolve([{ name: "Essay" }]); });
  } });
  const first = request("/api/materials?school=NYU");
  await ready;
  const second = request("/api/materials?school=nyu");
  assert.equal((await request("/api/materials?school=UCL")).status, 503);
  release();
  const results = await Promise.all([first, second]);
  for (const result of results) assert.equal(result.status, 200);
  assert.equal(calls, 1);
});
