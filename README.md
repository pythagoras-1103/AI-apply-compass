# APPLY COMPASS · 申请罗盘

海外本科申请工作台：大学库、申请材料清单、勾选进度、时间线和 AI 文书。

## 运行
Node.js >=22。根目录创建 .env，填写 MOONSHOT_API_KEY 和 PORT=3000。
`npm ci` → `npm start` → http://localhost:3000。
Windows PowerShell 可以用 npm.cmd。详细操作见 START_HERE.md。

## 2026-10-10 修复
- 材料查询改用 Kimi 官方 POST /v1/tools/search_pro，先检索正文，再调用 kimi-k2.6 整理；MIT 直接通过 /v1/tools/fetch 获取已知官方本科招生页，避免部门/MBA搜索噪声。
- 不再依赖旧 builtin_function/$web_search 工具循环。
- 大学库/NYU 使用明确官网域名；中文常用名与英文名映射到同一搜索目标。
- 搜索502/503/504最多重试一次；401/429不自动重试。
- 模型输出采用 JSON object 格式；格式失败最多额外整理一次，不重新搜索。
- 仅接受 sourceUrl 为本次实际检索 URL 的条目，无正文/无可靠条目就明确失败，不编造。
- 搜索请求45秒、模型请求90秒、材料全程180秒，页面190秒；限制请求体与并发等原保护保留。
- 截止日期须在来源正文包含完整年月日，且未过期；无法确认则清空，避免推算年度。
- 明确反馈凭证、搜索、格式、超时和速率错误，不输出密钥或原始错误正文。
- 增加 npm run diagnose（只测试认证）和 npm run diagnose -- --live（真实材料+文书，产生额度用量）。
- 更新两项间接依赖及锁文件，处理安装审计提示。

## 验证
`npm run check`、`npm test`、`npm audit`。
模拟测试不产生 API 费用；live 诊断产生实际搜索与模型费用。

## 数据
申请学校、材料及勾选保存在当前浏览器当前来源的 localStorage；不跨设备同步。不同端口、localhost/127.0.0.1、浏览器分别存储。文书正文不持久保存。

## 安全与可信度
Key 只写根目录 .env，不放 public、不提交到仓库。服务器默认依旧监听运行环境的默认地址；本机使用无需开放防火墙端口。无账户登录，本版本用于个人本地使用。
排名数据是原包的固定快照，本次没有核实或调整排名。来源链接命中检索结果不等于内容已人工核实；申请期限以官网为准。

官方接口依据：https://platform.kimi.com/docs/guide/best-practices-for-web-search
旧工具下线说明：https://platform.kimi.com/docs/guide/use-web-search
