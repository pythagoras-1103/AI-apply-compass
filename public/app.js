import { mountSite, getUniversities, toast, schoolLink } from "./js/shared.js";
import { createApplicationStore, itemKey, resolveSchool } from "./js/storage.js";

mountSite("universities");
const schoolTabs = document.querySelector("#schoolTabs");
const schoolTitle = document.querySelector("#schoolTitle");
const sourceBadge = document.querySelector("#sourceBadge");
const loadingBox = document.querySelector("#loadingBox");
const typingText = document.querySelector("#typingText");
const materialsList = document.querySelector("#materialsList");
const progressBlock = document.querySelector("#progressBlock");
const progressRing = document.querySelector("#progressRing");
const progressPercent = document.querySelector("#progressPercent");
const progressText = document.querySelector("#progressText");
const celebration = document.querySelector("#celebration");
const schoolSearch = document.querySelector("#schoolSearch");
const schoolInput = document.querySelector("#schoolInput");
const searchButton = document.querySelector("#searchButton");
const queryNotice = document.querySelector("#queryNotice");

let currentSchool = "NYU";
let currentItems = [];
let checkedItems = new Set();
let loading = false;
let requestId = 0;
let activeController;
let applicationStore;
let catalogue = [];

function updateWorkspaceLinks() {
  const school = resolveSchool(currentSchool, catalogue);
  document.querySelector("#materialsTimeline").href = schoolLink("timeline", school.id);
  document.querySelector("#materialsEssay").href = schoolLink("essay", school.id);
}

function restoreSaved(record) {
  sourceBadge.textContent = "本机保存 · " + ({kimi:"Kimi 联网结果",cache:"AI 查询结果 · 缓存",fallback:"本地备用清单 · 请核对官网"}[record.source]);
  renderMaterials(record.items, record.checked);
  showNotice((record.source === "fallback" ? "本地备用清单 · 请以学校官网最新要求为准。" : "已恢复本机保存的材料与进度；请核对官网最新要求。") + " 查询时间：" + record.queriedAt);
  setLoading(false);
  updateProgress();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setActiveSchool(school) {
  for (const button of schoolTabs.querySelectorAll(".school-tab")) {
    button.classList.toggle("active", button.dataset.school === school);
  }
}

function setLoading(isLoading) {
  loading = isLoading;
  searchButton.disabled = isLoading;
  document.querySelector("#refreshMaterials").disabled = isLoading;
  searchButton.textContent = isLoading ? "查询中…" : "AI 查询";
  loadingBox.hidden = !isLoading;
  materialsList.hidden = isLoading;
  progressBlock.hidden = isLoading || currentItems.length === 0;
  celebration.hidden = true;
}

async function playTyping(id) {
  const text = "AI 正在查申请要求…";
  typingText.textContent = "";

  // 打字动画：让学生知道后台正在查资料，不是页面卡住了。
  for (const char of text) {
    if (!loading || id !== requestId) return;
    typingText.textContent += char;
    await new Promise((resolve) => setTimeout(resolve, 55));
  }
}

function getDaysUntil(deadline) {
  if (!deadline) return null;
  const due = new Date(`${deadline}T23:59:59`);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  if (due < now) return -Math.max(1, Math.ceil((now - due) / 86400000));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((day - today) / 86400000);
}

function getDeadlineBadge(deadline) {
  const days = getDaysUntil(deadline);

  if (days === null) {
    return {
      label: "截止日待确认",
      detail: "",
      level: "unknown"
    };
  }

  if (days < 0) {
    return {
      label: `已过 ${Math.abs(days)} 天`,
      detail: deadline,
      level: "danger"
    };
  }

  if (days <= 7) {
    return {
      label: `还剩 ${days} 天`,
      detail: deadline,
      level: "danger"
    };
  }

  if (days <= 21) {
    return {
      label: `还剩 ${days} 天`,
      detail: deadline,
      level: "warning"
    };
  }

  return {
    label: `还剩 ${days} 天`,
    detail: deadline,
    level: "normal"
  };
}

function updateProgress() {
  const total = currentItems.length;
  const done = checkedItems.size;
  const percent = total ? Math.round((done / total) * 100) : 0;

  progressBlock.hidden = total === 0 || loading;
  progressRing.style.setProperty("--progress", `${percent * 3.6}deg`);
  progressPercent.textContent = `${percent}%`;
  progressText.textContent = `已完成 ${done}/${total} 项`;
  celebration.hidden = !(total > 0 && done === total);
}

function renderMaterials(items, savedChecked = []) {
  currentItems = items;
  const completed = new Set(savedChecked);
  checkedItems = new Set(items.map((item,index) => completed.has(itemKey(item)) ? index : -1).filter(index => index >= 0));

  if (!items.length) {
    materialsList.innerHTML = `
      <div class="empty">
        没拿到清单，换一所学校或稍后再试。
      </div>
    `;
    updateProgress();
    return;
  }

  materialsList.innerHTML = items
    .map((item, index) => {
      const badge = getDeadlineBadge(item.deadline);
      const sourceUrl = safeSourceUrl(item.sourceUrl);

      return `
        <div class="material-row ${checkedItems.has(index) ? "done" : ""}" data-index="${index}">
          <button class="check-box" type="button" aria-pressed="${checkedItems.has(index)}" aria-label="${escapeHtml(item.name)}"></button>
          <span class="material-main">
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.description || "按学校官网最新说明准备。")}</small>
            ${sourceUrl ? `<a class="source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(item.sourceTitle || "查看来源并核对要求")}">查看来源 ↗</a>` : ""}
            ${item.verifiedAt ? `<small class="verified-date">查询日期：${escapeHtml(item.verifiedAt)}</small>` : ""}
          </span>
          <span class="deadline-badge ${badge.level}">
            <strong>${escapeHtml(badge.label)}</strong>
            ${badge.detail ? `<small>${escapeHtml(badge.detail)}</small>` : ""}
          </span>
        </div>
      `;
    })
    .join("");
  updateProgress();
}

function toggleMaterial(index) {
  if (checkedItems.has(index)) checkedItems.delete(index);
  else checkedItems.add(index);

  const row = materialsList.querySelector(`[data-index="${index}"]`);
  if (row) {
    const checked = checkedItems.has(index);
    row.classList.toggle("done", checked);
    row.querySelector(".check-box").setAttribute("aria-pressed", String(checked));
  }

  updateProgress();
  if (applicationStore?.saveChecked(currentSchool, [...checkedItems].map(i => itemKey(currentItems[i])))) toast("已保存进度");
}

function safeSourceUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return "";
  try {
    const url = new URL(value.trim());
    return url.hostname && !url.username && !url.password ? value.trim() : "";
  } catch { return ""; }
}

function showNotice(message) {
  queryNotice.textContent = message;
  queryNotice.hidden = !message;
}

async function loadMaterials(school, custom = false, force = false) {
  school = school.trim();
  if (!school || school.length > 120) return;
  activeController?.abort();
  const id = ++requestId;
  const controller = new AbortController();
  activeController = controller;
  const timer = setTimeout(() => controller.abort(), 190000);
  currentSchool = school;
  updateWorkspaceLinks();
  currentItems = [];
  checkedItems = new Set();
  setActiveSchool(custom ? "" : school);
  showNotice("");
  schoolTitle.textContent = `${school} 本科申请材料`;
  schoolInput.value = school;
  const saved = applicationStore?.getMaterials(school);
  if (saved && !force) {
    clearTimeout(timer);
    restoreSaved(saved);
    return;
  }
  sourceBadge.textContent = "查询中";
  materialsList.innerHTML = "";
  updateProgress();
  setLoading(true);
  playTyping(id);

  try {
    const identity = resolveSchool(school, catalogue);
    const querySchool = identity.id === "hku" ? "港大" : identity.id === "ucl" ? "UCL" : school;
    const response = await fetch(`/api/materials?school=${encodeURIComponent(querySchool)}`, { signal: controller.signal });
    if (!response.ok) {
      const messages = { 400: "请输入有效的学校名称", 429: "查询过于频繁，请稍后再试。", 503: "查询服务繁忙，请稍后再试。" };
      throw new Error(messages[response.status] || "AI 查询暂时失败，请稍后重试。");
    }

    const data = await response.json();
    if (id !== requestId) return;
    const badges = { kimi: "Kimi 联网结果", cache: "AI 查询结果 · 缓存", fallback: "本地备用清单 · 请核对官网", unavailable: "暂时无法查询" };
    if (!badges[data.source] || !Array.isArray(data.items)) throw new Error("AI 查询暂时失败，请稍后重试。");
    if (saved && saved.source !== "fallback" && (data.source === "fallback" || data.source === "unavailable")) {
      restoreSaved(saved);
      showNotice("本次联网查询未获得新结果，已保留原有本机清单与进度。请核对官网最新要求。");
      toast("查询失败，已恢复保存的清单");
      return;
    }
    applicationStore?.saveMaterials(school, data);
    sourceBadge.textContent = badges[data.source];
    showNotice(data.source === "fallback" ? "本地备用清单 · 请以学校官网最新要求为准" :
      data.source === "unavailable" ? (data.warning || "AI 查询暂时失败，且当前没有该学校的备用清单，请稍后重试。") :
        "AI 整理结果，默认参考下一适用入学年度；未确认当前周期的日期留空。请核对来源原文、轮次和专业。");
    renderMaterials(Array.isArray(data.items) ? data.items : [], applicationStore?.getMaterials(school)?.checked || []);
  } catch (error) {
    if (id !== requestId) return;
    sourceBadge.textContent = "查询失败";
    if (saved) restoreSaved(saved);
    else renderMaterials([]);
    toast("查询失败");
    showNotice(error.name === "AbortError" ? "查询超时，请稍后重试。" :
      error instanceof TypeError ? "网络异常，请稍后重试。" :
        ["请输入有效的学校名称", "查询过于频繁，请稍后再试。", "查询服务繁忙，请稍后再试。"].includes(error.message) ?
          error.message : "AI 查询暂时失败，请稍后重试。");
  } finally {
    clearTimeout(timer);
    if (id === requestId) {
      setLoading(false);
      updateProgress();
    }
  }
}

schoolTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-school]");
  if (!button || (loading && button.dataset.school === currentSchool)) return;
  loadMaterials(button.dataset.school);
});

materialsList.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const row = event.target.closest(".material-row[data-index]");
  if (!row) return;
  toggleMaterial(Number(row.dataset.index));
});

schoolInput.addEventListener("input", () => setActiveSchool(""));
schoolSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  if (loading) return;
  if (!schoolInput.value.trim()) {
    showNotice("请输入有效的学校名称");
    return;
  }
  loadMaterials(schoolInput.value, true, true);
});

document.querySelector("#refreshMaterials").addEventListener("click", () => {
  if (!loading) loadMaterials(currentSchool, true, true);
});
document.querySelector("#saveApplication").addEventListener("click", () => {
  if (applicationStore?.add(currentSchool)) toast("已加入我的申请");
});
getUniversities().catch(() => []).then(schools => {
  catalogue = schools;
  let storage;
  try { storage = localStorage; } catch { toast("本地保存不可用，当前进度无法跨刷新保留。"); }
  applicationStore = createApplicationStore(storage, catalogue, () => toast("本地保存不可用，请检查浏览器存储空间与设置。"));
  const requested = new URLSearchParams(location.search).get("school");
  currentSchool = requested?.trim() || "NYU";
  loadMaterials(currentSchool, Boolean(requested));
});
