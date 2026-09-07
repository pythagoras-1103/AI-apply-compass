const string = (value) => typeof value === "string" ? value.trim() : "";

export function normalizeSchool(school) {
  return string(school).normalize("NFKC").replace(/\s+/gu, " ").toLowerCase();
}

export function validSchool(school) {
  return typeof school === "string" && school.trim().length > 0 &&
    school.trim().length <= 120 && /[\p{L}\p{N}]/u.test(school) &&
    !/[\p{Cc}\p{Cf}<>{}\[\]\\]/u.test(school);
}

export function safeUrl(value) {
  const text = string(value);
  if (!/^https?:\/\//i.test(text)) return "";
  try {
    const url = new URL(text);
    return url.hostname && !url.username && !url.password ? text : "";
  } catch { return ""; }
}

export function validDate(value) {
  const text = string(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
}

export function normalizeChecklist(items, verifiedAt = "") {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      name: string(item.name || item.material || item["材料名"]),
      description: string(item.description || item.note || item["一句话说明"]),
      deadline: validDate(item.deadline || item.dueDate || item["截止日期"]),
      sourceTitle: string(item.sourceTitle),
      sourceUrl: safeUrl(item.sourceUrl),
      verifiedAt: validDate(verifiedAt || item.verifiedAt)
    })).filter((item) => item.name);
}

// Balanced scanning respects quoted brackets and escaped quotes; never executes model output.
export function extractJsonArray(value) {
  if (typeof value !== "string" || value.length > 200000) throw new Error("Invalid JSON response");
  const unwrap = (parsed) => {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    throw new Error("Expected checklist array");
  };
  try { return unwrap(JSON.parse(value.trim())); } catch { /* Try fenced/prose-wrapped JSON. */ }
  let scanned = 0;
  for (let start = 0; start < value.length; start++) {
    if (!"[{".includes(value[start])) continue;
    const stack = [];
    let quoted = false;
    let escaped = false;
    for (let end = start; end < value.length; end++) {
      if (++scanned > 1000000) throw new Error("JSON scan limit exceeded");
      const char = value[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === "[" || char === "{") stack.push(char);
      else if (char === "]" || char === "}") {
        if (stack.pop() !== (char === "]" ? "[" : "{")) break;
        if (!stack.length) {
          try { return unwrap(JSON.parse(value.slice(start, end + 1))); } catch { /* Next candidate. */ }
          start = end;
          break;
        }
      }
    }
  }
  throw new Error("Cannot parse checklist JSON");
}
