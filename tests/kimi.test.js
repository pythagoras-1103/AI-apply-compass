import test from "node:test";
import assert from "node:assert/strict";
import { fetchKimiChecklist, KIMI_TOOLS, kimiFailureReason } from "../src/kimiClient.js";

const final = { finish_reason: "stop", message: { role: "assistant", content: '{"items":[{"name":"Essay","sourceUrl":"https://example.org","verifiedAt":"2000-01-01"}]}' } };
const tool = (id) => ({ id, type: "function", function: { name: "$web_search", arguments: '{ "query": "admissions" }' } });
const reply = (choice) => ({ ok: true, json: async () => ({ choices: [choice] }) });
const options = { apiKey: "test-only-placeholder", now: () => new Date("2026-09-07T12:00:00Z") };

test("failure diagnostics categorize errors without exposing upstream secrets", () => {
  assert.equal(kimiFailureReason(new Error("Kimi key not configured")), "key_not_configured");
  assert.equal(kimiFailureReason(new Error("Kimi HTTP 401")), "Kimi HTTP 401");
  assert.equal(kimiFailureReason(new Error("Kimi HTTP 401 private credential")), "upstream_or_network_error");
  assert.equal(kimiFailureReason(new SyntaxError("private response body")), "invalid_json");
  assert.equal(kimiFailureReason({ name: "AbortError", message: "private" }), "timeout");
  assert.equal(kimiFailureReason(new Error("Kimi round limit exceeded")), "round_limit");
});

test("multiple tool calls round-trip with complete assistant messages and exact arguments", async () => {
  const calls = [];
  const assistant = { role: "assistant", content: null, tool_calls: [tool("one"), tool("two")], reasoning_content: "retained" };
  const fetchImpl = async (url, request) => {
    assert.equal(url, "https://api.moonshot.cn/v1/chat/completions");
    calls.push(JSON.parse(request.body));
    return reply(calls.length === 1 ? { finish_reason: "tool_calls", message: assistant } : final);
  };
  const items = await fetchKimiChecklist("NYU", { ...options, fetchImpl });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.model, "kimi-k2.6");
    assert.deepEqual(call.thinking, { type: "disabled" });
    assert.deepEqual(call.tools, KIMI_TOOLS);
  }
  assert.deepEqual(calls[1].messages[2], assistant);
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(calls[1].messages[index + 3], { role: "tool", tool_call_id: assistant.tool_calls[index].id,
      name: "$web_search", content: assistant.tool_calls[index].function.arguments });
  }
  assert.equal(items[0].verifiedAt, "2026-09-07");
});

test("tool loop stops after four requests", async () => {
  let count = 0;
  await assert.rejects(fetchKimiChecklist("NYU", { ...options, fetchImpl: async () => {
    count++;
    return reply({ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [tool(String(count))] } });
  } }), /round limit/);
  assert.equal(count, 4);
});

test("bad status, malformed JSON, empty and truncated responses fail safely", async () => {
  await assert.rejects(fetchKimiChecklist("NYU", { ...options, fetchImpl: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
  for (const content of ["not json", "[]", '{"items":[null]}']) {
    await assert.rejects(fetchKimiChecklist("NYU", { ...options, fetchImpl: async () => reply({ ...final, message: { role: "assistant", content } }) }));
  }
  await assert.rejects(fetchKimiChecklist("NYU", { ...options, fetchImpl: async () => reply({ ...final, finish_reason: "length" }) }), /Incomplete/);
  await assert.rejects(fetchKimiChecklist("NYU", { ...options, apiKey: "" }), /not configured/);
});

test("timeout remains active while reading the response body", async () => {
  await assert.rejects(fetchKimiChecklist("NYU", { ...options, timeoutMs: 10, fetchImpl: async (_url, { signal }) => ({
    ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("body aborted")), { once: true }))
  }) }), /body aborted/);
});

test("unknown tools and missing IDs cannot continue", async () => {
  for (const call of [{ ...tool("one"), id: "" }, { ...tool("one"), function: { name: "exec", arguments: "{}" } }]) {
    await assert.rejects(fetchKimiChecklist("NYU", { ...options, fetchImpl: async () => reply({ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [call] } }) }), /Invalid/);
  }
});
