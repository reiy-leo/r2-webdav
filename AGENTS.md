# AGENTS.md

r2-webdav：Rei 的个人 WebDAV 服务，部署在 https://r.rei8t.dev。Cloudflare Worker 做 WebDAV 协议层，文件存在 R2。fork 自 [abersheeran/r2-webdav](https://github.com/abersheeran/r2-webdav)（Apache-2.0）。

## 目标和边界

- 给 WebDAV 客户端（同步工具、Navill 扩展等）一个稳定、不限流的网盘。
- 浏览器打开时给一个能用的文件管理页：浏览、上传、新建文件夹、重命名、删除、下载。
- 不做：多用户、分享链接、在线预览编辑、Google OAuth 登录。
- 硬规则在 `.agents/rules/`，动代码前先看 `webdav-compat.md`。

## 技术栈

- Worker：TypeScript，`src/index.ts`（上游代码，WebDAV 全部方法和 LOCK）。
- 界面：React 19 + [Cloudflare Kumo](https://github.com/cloudflare/kumo) + Tailwind 4 + Lucide 图标，中文，支持明暗。设计规范见 `.agents/skills/kumo-design/SKILL.md`。
- 构建：Vite + `vite-plugin-singlefile`，`web/` 打成 `dist-web/index.html`，`wrangler.toml` 的 `[[rules]]` 把它当 Text 模块内联进 Worker。
- 包管理：pnpm。

## 目录

```
src/index.ts        Worker 入口和 WebDAV 实现
src/html.d.ts       *.html 模块类型
web/                浏览器文件管理页（React）
  src/App.tsx       页面和全部交互
  src/dav.ts        同源 PROPFIND / PUT / MKCOL / MOVE / DELETE
  src/theme.ts      明暗切换
dist-web/           构建产物，不入库
scripts/kumo-lint.mjs   检查 kumo-design 规则
.agents/            规则、提示词、决策记录、skills
```

## 命令

```sh
pnpm install
pnpm build          # 构建界面
pnpm dev            # 构建后 wrangler dev
pnpm typecheck
pnpm lint           # kumo-design 规则检查
pnpm run deploy     # 构建并部署到 r.rei8t.dev
```

本地开发要在 `.dev.vars` 里写 `USERNAME` 和 `PASSWORD`（见 `.dev.vars.example`）。

## 部署

- Worker `r2-webdav`，自定义域名 `r.rei8t.dev`，R2 桶 `r2-webdav`，Cloudflare 账号 `9151f72e404dd53f20b8e6667893237d`。
- 密码是 Worker secret：`pnpm exec wrangler secret put PASSWORD`。用户名 `rei`。
- 部署完按 `.agents/prompts/regression.md` 回归。

## 约定

- 每轮改完 commit 并 push 到 `origin main`；发版、打 tag 前先问 Rei。
- 界面只用 Kumo 语义色（`bg-kumo-*`、`text-kumo-*`），不写 `dark:`；图标用 `lucide-react`。
- 对话框一直渲染，用 `open` 控制，不要条件渲染。
- 状态码给用户看时带中文说明，比如「412 前提条件不满足」。
- 中文文案写得像人说话。
