# 今晚使用：Windows 与 Mac

这份修复包没有真实 .env、API Key 或 node_modules。保留你原项目的 .env；两个 Key 不冲突，程序一次只读取一个，多个 Key 一般共享账号额度/限制。

## 更新现有项目（推荐）
1. 在正在运行服务的终端按 Control+C（Windows 为 Ctrl+C）。
2. 解压修复包。进入里面的 AI-apply-compass-repaired 文件夹。
3. 将修复包中的 src、public、scripts、tests 文件夹和 package.json、package-lock.json、README.md、START_HERE.md 复制到原项目根目录，同名文件选择替换。不要删除原项目的 .env。
4. 必须在原项目根目录（直接包含 package.json）重新安装依赖。
5. 按下面对应系统的命令启动。
6. 固定使用 http://localhost:3000 和原浏览器，勾选记录保存在浏览器，不保存在项目文件夹。

## Windows PowerShell
在原项目文件夹的资源管理器地址栏输入 powershell，回车。
依次执行，每条执行完再继续：

```powershell
npm.cmd ci
Remove-Item Env:MOONSHOT_API_KEY -ErrorAction SilentlyContinue
npm.cmd run diagnose
npm.cmd start
```

## Mac
用 VS Code 打开原项目文件夹，菜单 Terminal → New Terminal。
依次执行：

```sh
npm ci
unset MOONSHOT_API_KEY
npm run diagnose
npm start
```

Node 必须 >=22。诊断显示 HTTP 200 和模型 available: true 表示 Key 认证成功，不代表搜索或文书已成功。
终端保留运行。浏览器访问 http://localhost:3000，材料页点击“重新联网查询”。旧页面可能仍缓存旧脚本，Windows Ctrl+F5；Mac 浏览器 Command+Shift+R，或关闭标签重新打开。不要清理浏览器数据，以免丢失勾选记录。

## 如需完整真实诊断
先停止服务，再运行对应命令（会使用少量搜索与模型额度）：

Windows: `npm.cmd run diagnose -- --live`
Mac: `npm run diagnose -- --live`

它依次检查 Key、哈佛材料查询和短测试文书。不会打印 Key 或文书正文。检查结束后用 npm start 启动网站。

## 配置
根目录 .env（和 package.json 同层）：

```dotenv
MOONSHOT_API_KEY=粘贴真实完整Key
PORT=3000
```

不要使用 KIMI_API_KEY 等其他变量名。修改后保存并重启。Mac Finder 可用 Command+Shift+. 显示隐藏文件。终端 export 的 Key 会优先于 .env，因此上述启动步骤先清除终端变量。

## 成功标准
- /healthz 显示 {"ok":true}：后端启动。
- 材料来源标记 Kimi 联网结果：成功整理此次搜索正文。
- AI 查询结果 · 缓存：十分钟内成功结果，仍不是重新搜索。
- 本机保存：恢复浏览器记录；更新需点重新联网查询。
- 本地备用清单：AI 未成功，不能作为当前申请要求。

默认按当前时间参考下一适用入学年度（2026年10月查询参考2027入学）；只有官网正文能确认的当前日期才显示。MIT 读取官方本科招生目录页，其他学校优先搜索正文。

查询可能持续数十秒；最长总预算180秒，页面190秒停止等待。不要连点或同时大量查询。文书最长45秒，刷新不保存原稿，先在自己的文档保留原文。

## 常见错误
- key_not_configured：.env 未读到；检查名称、位置、变量名和是否重启。
- HTTP 401：凭证无效/平台不对应；检查开放平台 Key。
- HTTP 429：账户额度或速率受限；两个 Key 不会获得两个独立账号的配额。
- timeout：网络或上游慢；稍后重试一次，不保证加长时间可以解决所有超时。
- no_search_evidence：没有可用官网正文；试英文学校全名，或去官网核对。
- empty_checklist：没有带本次搜索来源的可靠条目；不编造清单。
- invalid_json：模型格式异常；已限制自动恢复为最多一次，不无限重试。
- EADDRINUSE：端口已有服务；回旧终端停止，再启动。

## 信息边界
官网正文搜索片段并非完整站点审核。返回材料仍需核对申请年度、轮次、专业、国际生类别和官网原文；未知日期留空。非大学库学校暂依靠模型判断来源身份，域名限制不等于事实逐条人工验证。
