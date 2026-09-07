import { siteConfig } from "./siteConfig.js";
export { siteConfig };
export const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
export const schoolLink = (page, school) => "/" + page + ".html?school=" + encodeURIComponent(school);
let catalogue;
export function getUniversities() {
  if (!catalogue) catalogue = fetch("/data/qsTop15.json").then(r => { if (!r.ok) throw new Error("大学库暂时无法加载，请刷新重试。"); return r.json(); });
  return catalogue;
}
let toastTimer;
export function toast(message) {
  const box = document.querySelector("#toast");
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 3000);
}
export function emptyState(title, message, href = "/universities.html", label = "浏览 QS Top 15 →") {
  return '<div class="empty-state"><span class="empty-mark" aria-hidden="true">↗</span><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p><a class="button" href="' + escapeHtml(href) + '">' + escapeHtml(label) + "</a></div>";
}
export function mountSite(active) {
  document.title = document.title + " · " + siteConfig.brandName;
  const header = document.querySelector("#siteHeader");
  const nav = [["home", "/index.html", "首页"], ["universities", "/universities.html", "大学"], ["applications", "/applications.html", "我的申请"], ["essay", "/essay.html", "AI 文书"]];
  header.innerHTML = '<a class="brand" href="/index.html"><span class="brand-symbol" aria-hidden="true">↗</span><span><strong>' + escapeHtml(siteConfig.brandName) + '</strong><small>' + escapeHtml(siteConfig.brandNameEn) + '</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNav">菜单 ☰</button><nav id="siteNav" aria-label="主导航">' +
    nav.map(([id, href, label]) => '<a href="' + href + '"' + (id === active ? ' aria-current="page"' : "") + ">" + label + "</a>").join("") +
    '</nav><a class="button nav-cta" href="/universities.html">开始规划 →</a>';
  const menu = header.querySelector(".menu-toggle");
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    header.classList.toggle("menu-open", open);
  });
  document.querySelector("#siteFooter").innerHTML = '<span>' + escapeHtml(siteConfig.brandName) + ' · ' + escapeHtml(siteConfig.tagline) + '</span><span>一步一步，靠近你的下一站。</span>';
}

