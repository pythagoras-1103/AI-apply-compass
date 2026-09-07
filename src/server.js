import dotenv from "dotenv";
import express from "express";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFallbackChecklist, getFallbackSchoolNames } from "./fallbackData.js";
import { fetchKimiChecklist, kimiFailureReason } from "./kimiClient.js";
import { normalizeSchool, validSchool } from "./checklistUtils.js";
import { ChecklistCache } from "./cache.js";
import { analyzeEssay, validEssayInput } from "./essayClient.js";

const root = fileURLToPath(new URL("../", import.meta.url));
dotenv.config({ path: path.join(root, ".env") });

export function createApp({ queryKimi = fetchKimiChecklist, cache = new ChecklistCache(),
  rateLimitMax = 25, maxConcurrent = 5, trustProxy = false,
  queryEssay = analyzeEssay, essayRateLimitMax = 8, maxEssayConcurrent = 2 } = {}) {
  const app = express();
  const pending = new Map();
  let pendingEssays = 0;
  app.disable("x-powered-by");
  // Trust only a known deployment proxy, never arbitrary forwarding headers.
  app.set("trust proxy", trustProxy);
  app.set("query parser", "simple");
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.get("/api/schools", (_req, res) => res.json({ schools: getFallbackSchoolNames() }));
  app.get("/api/materials", (req, res, next) => {
    if (!validSchool(req.query.school)) return res.status(400).json({ error: "请输入有效的学校名称" });
    next();
  }, rateLimit({ windowMs: 600000, limit: rateLimitMax, standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "查询过于频繁，请稍后再试。" } }), async (req, res) => {
    const school = req.query.school.trim();
    const key = normalizeSchool(school);
    const cached = cache.get(key);
    if (cached) return res.json({ school, source: "cache", items: cached });
    try {
      if (!pending.has(key)) {
        if (pending.size >= maxConcurrent) return res.status(503).json({ error: "查询服务繁忙，请稍后再试。" });
        const task = Promise.resolve().then(() => queryKimi(school)).then((items) => {
          if (!Array.isArray(items) || !items.length) throw new Error("Empty checklist");
          cache.set(key, items);
          return items;
        }).finally(() => pending.delete(key));
        pending.set(key, task);
      }
      const items = await pending.get(key);
      res.json({ school, source: "kimi", items });
    } catch (error) {
      // Never expose upstream bodies, prompts, credentials, or raw error messages.
      console.error(`Kimi 查询失败 [${kimiFailureReason(error)}]，使用该校备用数据或返回不可用状态。`);
      const items = getFallbackChecklist(school);
      res.json({ school, source: items ? "fallback" : "unavailable", items: items || [],
        warning: items ? "本地备用清单 · 请以学校官网最新要求为准" :
          "AI 查询暂时失败，且当前没有该学校的备用清单，请稍后重试。" });
    }
  });
  app.post("/api/essay/analyze", rateLimit({ windowMs: 600000, limit: essayRateLimitMax,
    standardHeaders: "draft-7", legacyHeaders: false, message: { error: "分析过于频繁，请稍后再试。" } }),
  (req,res,next) => {
    if (!req.is("application/json")) return res.status(415).json({ error: "请使用 JSON 格式提交。" });
    next();
  }, express.json({ limit: "100kb" }), async (req,res) => {
    if (!validEssayInput(req.body)) return res.status(400).json({ error: "请填写有效学校、文书类型与正文；正文最多 12000 字符，题目最多 3000 字符。" });
    if (pendingEssays >= maxEssayConcurrent) return res.status(503).json({ error: "AI 文书分析暂时繁忙，请稍后重试。" });
    pendingEssays++;
    try { res.json(await queryEssay(req.body)); }
    catch { res.status(503).json({ error: "AI 文书分析暂时不可用，请稍后重试。" }); }
    finally { pendingEssays--; }
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  app.use(express.static(path.join(root, "public")));
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large" || error.type === "entity.parse.failed") return res.status(400).json({ error: "请求内容过长或 JSON 格式无效。" });
    res.status(500).json({ error: "服务暂时异常，请稍后重试。" });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const server = createApp().listen(port, () => console.log(`申请材料清单生成器已启动：http://localhost:${port}`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
