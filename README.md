# 申请罗盘 · AI 海外升学申请助手

原「申请材料清单生成器」已在同一个项目内横向扩展为 APPLY COMPASS 申请工作台。面向准备海外本科申请的中学生，保留 Vanilla HTML/CSS/JavaScript、Node.js + Express 和既有 Kimi 材料搜索链路。

## 当前功能

- 正式首页：五步申请流程与四项能力入口；示意卡明确标记为展示数据，不虚构截止日期。
- 大学库：QS World University Rankings 2027 Top 15，地区筛选、名称/简称搜索、大学详情与申请工作台。
- 申请材料：Kimi 联网整理、来源链接、勾选、进度环、倒计时、庆祝动画；继续保留 NYU / UCL / 港大快捷入口和任意学校查询。
- 我的申请：加入/移除学校，跨刷新保存，显示材料完成度与最近未过期的 Deadline。
- 时间线：只从本机保存的材料结果提取有效日期，排序并显示今天、已截止、临近和未来；不另造截止日期。
- AI 文书：单次分析自己创作的文书，展示总体反馈、五项评分、优点、问题、建议及可折叠修改稿，可复制但不会覆盖原文。

品牌中文名、英文名和副标题统一配置在 `public/js/siteConfig.js`，修改品牌不需要逐页替换。源码目录与 npm 包名保持原样。

排名采用需求指定的 QS 2027 固定快照，并附 [QS 官方排名说明](https://www.topuniversities.com/student-info/choosing-university/worlds-top-100-universities) 链接。含 =2 和 =8 并列名次；静态数据只含学校名称、地点、排名、地区和别名，不含学费、录取率、SAT 政策或 Deadline。

## 产品定位与当前架构

面向正在准备海外本科申请的中学生：选择或输入学校，AI 查询申请材料和 Deadline，生成可勾选清单。

```text
Browser
  ↓
Node + Express
  ↓
Kimi API
  ↓
Web Search
```

## 本地运行

需要 Node.js 22 或更新的受支持版本。以下命令均在**项目根目录**运行（直接包含 package.json 的目录），不需要再嵌套一层同名文件夹。

```sh
npm install
```

把 `.env.example` 复制为 `.env`（PowerShell 可运行 `Copy-Item .env.example .env`，已有文件时不要覆盖），在本机编辑 `.env` 填入自己的 `MOONSHOT_API_KEY`。也可通过运行环境注入同名变量；环境变量优先于 `.env`。`.env` 按 server.js 所在项目根目录加载，与启动命令的工作目录无关。

```sh
npm run dev
```

访问 http://localhost:3000 。`PORT` 可修改端口。没有 Key 也能启动：三个快捷学校显示本地备用清单，其他学校显示暂时不可用。不得把 Key 放入 public、源码、README 或提交记录。`.env.example` 只含空 Key 和默认端口，`.gitignore` 忽略真实环境文件。

已有锁文件时可以用 `npm ci` 精确安装；`npm start` 与 `npm run dev` 均启动 Express，无构建步骤。`.env` 不能上传 GitHub。

## 工程结构

```text
public/
  index.html            正式首页
  universities.html     QS 2027 Top 15 大学库
  university.html       大学详情（?id=mit）
  materials.html        原材料页（?school=MIT 或学校全称）
  applications.html     我的申请
  timeline.html         申请时间线（?school=mit）
  essay.html            文书助手（?school=mit）
  app.js                唯一材料页面逻辑，渐进扩展旧代码
  styles.css            保留原材料动画及交互样式
  css/                  共享 site.css 及各页面样式
  js/                   siteConfig、shared、storage 与各新页面脚本
  data/qsTop15.json      15 所大学静态数据
src/server.js           Express 路由、校验、限流、并发合并、启动及退出
src/kimiClient.js       Kimi 搜索工具循环、超时、结果处理
src/essayClient.js      独立文书分析、输入/结果校验；不使用 Web Search
src/checklistUtils.js   JSON 提取、字段/URL/日期校验
src/fallbackData.js     唯一备用数据源
src/cache.js            有界内存缓存
scripts/check.js        JavaScript 语法检查
tests/                  Node 内置测试，无需真实 API Key
.github/workflows/ci.yml
.env.example
Dockerfile              生产运行镜像，仅复制运行所需文件
.dockerignore           排除环境文件、Git 元数据及开发文档
```

删除了未引用的 src/data.js、与 public 完全重复的 docs 网页、无依赖支持的 vite.config.js 及旧 Pages 部署 workflow。没有 Vite、dist 或虚假的 build 命令。

## 本地申请数据

`applyCompass.applications` 保存目标学校。`applyCompass.school.<id>.materials` 保存材料、source、queriedAt 和勾选标识；已知学校的 ID、全称与明确别名映射到同一记录。未收录学校使用规范化名称的编码 ID，不做模糊匹配，避免串校。

材料页有已保存结果时优先恢复，不因刷新自动再发 AI 请求；点击「重新联网查询」可更新。重新查询时仅将名称、说明和截止日均未变化的项目保留为完成，避免把旧要求的勾选移到新要求。失败或备用结果不会覆盖已有 AI 清单。首次访问无保存数据时自动查询一次。

「本机保存」与服务端 `cache` 明确区分。备用结果仍有免责声明，没有可靠日期就不生成时间线节点。移除目标学校需确认，只移除申请卡，不删除清单，重新加入可以继续准备。

数据仅存在当前浏览器、当前站点来源中，不跨设备同步；不同端口也是不同存储空间。清理浏览器数据会清除记录。存储损坏、禁用或空间不足会显示提示，不会静默宣称保存成功。文章正文与 API Key 从不写入此存储模块。

## API

`GET /healthz` 返回 `{"ok":true}`，不暴露环境或凭据。

`GET /api/schools` 返回三个快捷学校名。

例如：`GET /api/materials?school=NYU`。

`GET /api/materials?school=University%20of%20Sydney`：school 必须为单个字符串，trim 后 1–120 字符；拒绝控制字符、对象/数组、重复参数和明显结构化 payload。无效输入返回 HTTP 400 与 `{"error":"请输入有效的学校名称"}`。

成功处理的请求返回 `school`、`source`、`items`，备用/不可用时另有 `warning`。每项统一为：

```json
{
  "name": "材料名",
  "description": "说明与适用申请范围",
  "deadline": "",
  "sourceTitle": "",
  "sourceUrl": "",
  "verifiedAt": ""
}
```

| source | 含义 |
| --- | --- |
| kimi | 本次 Kimi 查询结果；相同学校的在途查询共用同一个请求 |
| cache | 十分钟内成功结果的缓存，保留原查询日期 |
| fallback | 该学校对应的本地备用清单，附明显免责声明 |
| unavailable | AI 失败且没有该校备用清单，items 为空；仍返回 HTTP 200 的明确业务状态 |

每 IP 十分钟最多 25 次有效材料接口请求，包括缓存命中；超限返回 HTTP 429、Retry-After 和 `{"error":"查询过于频繁，请稍后再试。"}`。静态文件、schools 和健康检查不限流。最多同时查询 5 个不同学校，繁忙时返回 HTTP 503；同校并发自动合并。其他内部错误仅返回友好提示。

### 文书接口

`POST /api/essay/analyze`，Content-Type 为 application/json，输入字段为 school、essayType、prompt（可选）、essayText。学校 1–120 字符，正文必填且最多 12000 字符，题目最多 3000 字符；JSON 请求体最多 100KB。类型为 Personal Statement、Common App Essay、Supplemental Essay、Why School 或 Other。

返回 summary、scores（story / structure / voice / language / promptFit）、strengths、issues、suggestions、revisedDraft。没有题目时 promptFit 为 null，界面显示「未提供题目」，不会假称知道该校当年的文书要求。评分仅是写作反馈，不是录取评估。

文书接口独立限流：每 IP 十分钟 8 次，最多并发 2 次。输入错误返回 400，Content-Type 错误 415，限流 429，服务繁忙或模型失败 503。每次 Kimi 请求超时 45 秒，包含响应体读取；不调用 $web_search，不重试、不缓存分析结果。服务端不打印文书或原始错误体，不把正文保存到磁盘，浏览器不自动本地保存，刷新会清除输入和分析。

点击分析会将文章、题目和学校发送给 Kimi，页面已提示这一点；服务商的数据处理规则适用。本轮不使用外部文书知识库、RAG、embedding、爬虫或下载案例。

学校缓存 key 采用 Unicode NFKC、trim、空白折叠和小写。仅缓存成功非空 AI 结果，TTL 十分钟，最多 100 条；访问/写入时清理过期条目并按最早写入顺序淘汰。不会将 fallback 或 unavailable 写入缓存。缩写和全称暂不做模糊归并，避免串校。

## Kimi 与数据可信度

模型固定为 `kimi-k2.6`，端点为 `https://api.moonshot.cn/v1/chat/completions`，使用 `thinking: {type:"disabled"}`。每轮均声明 `builtin_function` 类型的 `$web_search`，保存完整 assistant 消息，并为每个调用原样回传 arguments 和对应 tool_call_id。最多发起 4 次模型请求，每次超时 30 秒，计时覆盖响应体读取。异常、轮数超限、截断/空响应或 JSON 无法解析时转入该校 fallback。

本次产品扩展原样保留 `src/kimiClient.js`，没有调整材料搜索 Prompt、timeout、tool_calls 或 retry，也没有重新加入 temperature。已知的部分任意学校偶发 timeout / 搜索不稳定问题留待后续专门处理。`.env` 未读取展示、修改、复制或删除。

实现依据：[Kimi 官方联网搜索文档](https://platform.kimi.com/docs/guide/use-web-search)。未使用普通 function 替代内置搜索；通过 prompt 约束严格 JSON，避免强行将工具中间轮设置为最终 JSON 输出。

失败时服务端仅记录固定原因类别（如 key_not_configured、timeout、invalid_json、round_limit）或 HTTP 状态码，不记录原始错误正文、Key 或模型上下文；浏览器仅收到友好提示。

解析器支持数组、items 对象、Markdown 代码块和少量前后文本，不使用 eval；过滤空名称，对日期进行实际日历校验。优先官方本科 Admissions 来源，要求模型说明年份、申请轮次、专业及申请人类别，不能确认的日期与网址留空。verifiedAt 由服务器写入查询当天 UTC 日期，仅代表查询日期，不代表人工核实。

URL 仅检查 http(s) 格式及禁止内嵌凭据，**不验证网页存在、官方身份或内容正确性**。因此前端用「查看来源 ↗」而不是声称所有链接都是官方来源；打开新标签不改变勾选，链接带 noopener noreferrer。提交材料前请核对原文。学校名称的输入限制也不能证明输入一定是真实大学。

原备用清单中的固定日期没有可靠核实记录，已清空；来源和 verifiedAt 也不伪填。备用清单显示「本地备用清单 · 请以学校官网最新要求为准」。未知学校绝不退回 NYU。

## 验证与 CI

```sh
npm run check
npm test
npm audit
```

测试使用 node:test、模拟 Kimi 响应与本地随机端口 HTTP 服务，不产生 AI 费用。覆盖备用数据隔离、字段/JSON/URL/日期校验、工具多轮回传与超时、缓存过期及容量、输入 400、限流 429、并发合并，以及前端错误、竞态、进度和来源交互。CI 在 push / pull_request 时执行 npm ci、npm run check、npm test，不部署网站。

package.json 对间接依赖 qs 使用 `^6.16.0` override：当前 Express 4 的依赖范围不能自动采用该安全修复版本。更新 Express 后应重新检查能否移除 override；锁文件与安装保持同步。

## 后续公网运行

选择支持长驻 Node 进程的平台或云服务器，在项目根目录执行 `npm ci --omit=dev`，启动 `npm start`，注入 MOONSHOT_API_KEY 与 PORT，健康检查路径使用 `/healthz`。无需前端构建。GitHub Pages 不能执行 Express，也不能隐藏服务端 Key，所以只将 GitHub 用于源码、协作和 CI。

**该项目需要 Node 后端，因此不能仅靠 GitHub Pages 完整运行。** 后续可以部署到任何满足要求的 Node/Docker 服务器，不绑定具体商业平台。

## Docker 运行准备

Dockerfile 使用官方 `node:22-bookworm-slim` 镜像，与 CI 的 Node 22 保持一致（参见 [Node 支持周期](https://nodejs.org/en/about/previous-releases) 和 [官方 Node 镜像](https://hub.docker.com/_/node)）。运行 `npm ci --omit=dev`，仅复制 package 文件、src、public；以非 root 的 node 用户运行，暴露 3000，启动命令为 `npm start`，包含 `/healthz` 健康检查。

以后在安装并启动 Docker 的机器上，在项目根目录执行：

```sh
docker build -t application-materials-generator .
docker run --rm --init -p 127.0.0.1:3000:3000 -e MOONSHOT_API_KEY application-materials-generator
```

运行前由宿主环境或服务器秘密管理功能设置 MOONSHOT_API_KEY；上述 `-e MOONSHOT_API_KEY` 继承宿主变量，不在命令中填写 Key。无 Key 可省略该参数测试备用数据。容器默认 PORT=3000；修改内部 PORT 时需相应修改端口映射。示例仅绑定本机，正式部署由 HTTPS 反向代理接入。

`.dockerignore` 默认排除所有内容，只放行运行必需文件，同时显式排除 `.env*`、node_modules、Git 元数据、README、日志及密钥文件。Dockerfile 不使用 `COPY . .`，没有 API Key 构建参数；真实 Key 仅在运行时注入，不能烘焙进镜像。这里的 `docker build` 仅打包运行镜像，不是前端构建，不产生 dist，也没有 npm run build。

本轮未执行实际 Docker 镜像构建或容器运行：本机未检测到可用 Docker 命令；这部分仍需在具备 Docker 的环境中验证。

## 部署边界与数据免责声明

部署时需要 HTTPS、进程重启管理和约 130 秒的代理请求超时以覆盖多轮查询。默认不信任 X-Forwarded-For；使用反向代理时，根据真实拓扑在启动处为 createApp 传入可信代理地址/网段（trustProxy），并限制后端只能由该代理访问。不要简单设置 true，否则可能允许伪造 IP；未配置时用户可能共用代理 IP 配额。

当前缓存、在途请求和限流均为单进程内存，重启清空，多实例不共享。IP 限流与并发限制是基础保护，无法阻止分布式刷额度；正式开放前应在服务商设置预算/配额与告警，需要时增加登录、验证码、共享限流存储及全局预算。没有在本轮购买域名或部署任何公网服务器。

界面会本地保存学校、材料和勾选状态，刷新后恢复。无日期时显示待确认；有日期时按浏览器本地日期计算倒计时，7 天内红色、21 天内橙色；保留动画与移动端布局。时间线中的已过日期显示「已截止」。

## 本轮验证与范围

运行 `npm.cmd run check`、`npm.cmd test`。语法检查递归覆盖 src、public（包括 css 目录以外的所有 JS 子目录）、scripts 和 tests。保留原测试，并新增 QS 数据、学校身份映射、本地存储、时间线和文书 API 测试。

浏览器回归使用隔离端口上的明确 `[QA]` 测试数据，不把这些材料与日期写入生产数据文件，也不伪称是真实 Kimi 结果。验证 390 / 768 / 1440 三个宽度、大学筛选、MIT 工作台、加入与刷新、勾选与来源链接、庆祝、日期排序、文书模拟提交和复制；真实服务另做页面及输入校验检查。

没有实现注册/登录、云数据库、会员付费、学校主站接入、录取概率、测评、知识库或批量爬取。本轮仅在原项目修改，没有新建 V2 项目、自动 commit/push 或公网部署。

AI 查询和本地备用信息都可能随大学政策变化。最终申请要求和 Deadline 必须以大学官方 Admissions 页面为准。
"# AI-" 
