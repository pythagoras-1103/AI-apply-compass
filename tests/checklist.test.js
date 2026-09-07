import test from "node:test";
import assert from "node:assert/strict";
import { getFallbackChecklist } from "../src/fallbackData.js";
import { normalizeChecklist, extractJsonArray, safeUrl, validSchool, normalizeSchool } from "../src/checklistUtils.js";
import { ChecklistCache } from "../src/cache.js";

test("fallback is school-specific, case-insensitive, and returns independent data", () => {
  const items = getFallbackChecklist(" nyu ");
  assert.equal(items[0].name, "高中成绩单");
  items[0].name = "changed";
  assert.equal(getFallbackChecklist("NYU")[0].name, "高中成绩单");
  for (const school of ["Harvard", "", "constructor", "__proto__", "toString"]) assert.equal(getFallbackChecklist(school), null);
  assert.equal(getFallbackChecklist("UCL")[0].name, "UCAS 申请表");
  assert.equal(getFallbackChecklist("港大")[0].name, "网上申请表");
  assert.ok(getFallbackChecklist("NYU").every((item) => item.deadline === "" && item.verifiedAt === ""));
});

test("normalization supports English and Chinese fields and filters malformed items", () => {
  const input = [{ name: " Essay ", description: " note ", deadline: " 2026-11-01 " },
    { 材料名: " 成绩单 ", 一句话说明: " 盖章 ", 截止日期: "2026-11-02" }, null, 1, {}, { name: " " }];
  const items = normalizeChecklist(input);
  assert.deepEqual(items[0], { name: "Essay", description: "note", deadline: "2026-11-01", sourceTitle: "", sourceUrl: "", verifiedAt: "" });
  assert.equal(items.length, 2);
  assert.equal(items[1].description, "盖章");
  assert.equal(items[1].deadline, "2026-11-02");
  assert.equal(normalizeChecklist([{ name: "x", deadline: "2026-02-30" }])[0].deadline, "");
  assert.equal(normalizeChecklist([{ name: "x", verifiedAt: "2000-01-01" }], "2026-09-07")[0].verifiedAt, "2026-09-07");
});

test("URL validation rejects unsafe protocols, malformed URLs and credentials", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "//example.org", "https://", "https://a:b@example.org", {}, "garbage"]) assert.equal(safeUrl(url), "");
  for (const url of ["https://www.nyu.edu/admissions", "http://example.org/path?q=x"]) {
    assert.equal(safeUrl(` ${url} `), url);
    assert.equal(normalizeChecklist([{ name: "x", sourceUrl: url }])[0].sourceUrl, url);
  }
  assert.equal(normalizeChecklist([{ name: "x", sourceUrl: "javascript:foo" }])[0].sourceUrl, "");
});

test("JSON parser accepts arrays, items objects, fences, prose and quoted brackets", () => {
  for (const text of ["[]", '{"items":[]}', '```json\n{"items":[]}\n```', "结果如下： [] 完毕"]) assert.deepEqual(extractJsonArray(text), []);
  const items = [{ name: 'essay [a] "quote" \\ end', description: "brace }" }];
  assert.deepEqual(extractJsonArray(`说明 ${JSON.stringify({ items })} 完毕`), items);
  for (const text of ["nonsense", '{"foo":[]}', "[broken]", "{items: []}", "null"]) assert.throws(() => extractJsonArray(text));
});

test("school validation rejects arrays, objects, control characters and long payloads", () => {
  for (const school of [undefined, [], {}, "", "   ", "a".repeat(121), "x\nignore", "<script>", "{}", "\u200b"]) assert.equal(validSchool(school), false);
  for (const school of ["港大", "University of Sydney", "St. John's University", "École Polytechnique"]) assert.equal(validSchool(school), true);
  assert.equal(normalizeSchool("  ＮＹＵ  "), "nyu");
});

test("cache expires at TTL, is bounded and does not expose mutable references", () => {
  let now = 0;
  const cache = new ChecklistCache({ ttlMs: 100, maxEntries: 2, now: () => now });
  cache.set("a", [{ name: "a" }]);
  cache.get("a")[0].name = "changed";
  assert.equal(cache.get("a")[0].name, "a");
  cache.set("b", []);
  cache.set("c", []);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.entries.size, 2);
  now = 100;
  assert.equal(cache.get("c"), undefined);
  assert.equal(cache.entries.size, 0);
});
