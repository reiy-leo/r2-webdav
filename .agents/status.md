# 项目现状（交接用）

新 session 先读这份，再按需看 `AGENTS.md`（工程规则）、`.agents/rules/`（硬规则）、`.agents/prompts/regression.md`（部署后回归）、`.agents/memory/decisions.md`（决策记录）。这份只讲「现在到哪了、还欠什么、代码大致怎么组织」，细节以那几份为准。

更新于 2026-11-02，对应 main `174c0ca`。

## 一、项目是什么

- **r2-webdav**：Rei 的个人 WebDAV 网盘，地址 https://r.rei8t.dev。Cloudflare Worker 做 WebDAV 协议层，文件存在 R2 桶 `r2-webdav`。
- 用途：替代坚果云 WebDAV（坚果云免费版 30 分钟限 600 次请求）。Navill 扩展的书签同步就连在这里（根目录下的 `navill-bookmarks/`）。
- fork 自 [abersheeran/r2-webdav](https://github.com/abersheeran/r2-webdav)（Apache-2.0），仓库 `reiy-leo/r2-webdav`（公开）。上游 `LICENSE` 不能动。
- 浏览器打开是中文文件管理页：React 19 + Cloudflare Kumo + Lucide 图标，支持明暗。WebDAV 客户端照常连接，看不到这个页面。
- 只给 Rei 自己用：一个账号，HTTP Basic 认证。不做多用户、分享链接、在线预览、Google OAuth。

## 二、版本和分支

- 没有 tag，`package.json` 版本还是 `0.0.0`。这个项目不发版，改完直接部署。要打 tag 先问 Rei。
- 只有 `main` 一个分支，没有 worktree。直接在 main 上开发，不要 force-push。
- remote：`origin` = `git@github.com:reiy-leo/r2-webdav.git`（SSH 推送）；`upstream` = `https://github.com/abersheeran/r2-webdav.git`。
- 上游最新提交 `6ce5bfe`（2026-10-11，GET/HEAD 的 If-None-Match 返回 304）已经在 main 里，2026-11-02 查过上游没有新提交。
- 我们的提交只有两个：
  - `9e17294`：部署配置（R2 桶名、pnpm、网站图标）。
  - `174c0ca`：Kumo 文件管理界面、CI 改 pnpm、补 `AGENTS.md` 和 `.agents/`。
- 线上 Worker 版本 `2779f65f`（2026-10-25 部署），和 `174c0ca` 一致。

## 三、已经做完的功能

| 模块 | 现状 | 细节 |
|---|---|---|
| WebDAV | 上游全部方法：PROPFIND、PROPPATCH、MKCOL、GET、HEAD、PUT、DELETE、COPY、MOVE、LOCK、UNLOCK | `src/index.ts`，上游 README |
| 认证 | HTTP Basic，用户名 `rei`，密码是 Worker secret；不对返回 401 未授权 | `.agents/rules/webdav-compat.md` |
| 跨域 | OPTIONS 预检放行全部方法和 `Authorization`、`Depth`、`Destination`、`Overwrite` 等头，Navill 扩展靠它 | 同上 |
| 浏览器页面 | `Accept` 带 `text/html` 的目录 GET 返回内联的单文件 HTML；不带的仍回上游的简单链接列表 | `src/index.ts` 的 `handle_get` |
| 浏览 | 面包屑、文件表格（名称、大小、修改时间），文件夹在前，三列都能排序；进文件夹用 `pushState`，不整页刷新，浏览器后退能用；空状态、加载中、出错重试 | `web/src/App.tsx` |
| 上传 | 按钮或拖拽，多文件，右下角进度面板，可取消；拖入整个文件夹会跳过并提示 | `App.tsx`、`dav.ts` 的 `upload()` |
| 文件操作 | 新建文件夹（MKCOL）、重命名（MOVE，`Overwrite: F`，重名报错不覆盖）、删除（先弹确认）、下载、复制链接、复制 WebDAV 地址 | `App.tsx`、`dav.ts` |
| 错误提示 | 状态码带中文说明，比如「412 前提条件不满足，可能已有同名项」 | `dav.ts` 的 `STATUS_ZH` |
| 主题 | 浅色、深色、跟随系统，存在 localStorage 的 `r2dav-theme` | `web/src/theme.ts`、`web/index.html` |
| 网站图标 | https://m.rei8t.dev/i/jTleOJyB.png | `web/index.html`、`src/index.ts` |
| CI | `litmus.yml` 跑 WebDAV 协议测试，已从 npm 改成 pnpm，并先构建界面 | `.github/workflows/litmus.yml` |

## 四、代码怎么组织（快速地图）

```
src/index.ts          Worker 入口和 WebDAV 实现（约 1670 行，基本是上游代码）
                      我们只加了两处：顶部 import ../dist-web/index.html，handle_get 里返回浏览器页面
src/html.d.ts         *.html 文本模块的类型声明
web/index.html        页面外壳：中文、图标、主题初始化脚本（防闪白）
web/src/App.tsx       整个页面和全部交互（约 630 行）
web/src/dav.ts        同源 WebDAV 请求：list(PROPFIND Depth:1)、mkcol、move、remove、XHR upload，大小和时间格式化
web/src/theme.ts      明暗切换
web/src/styles.css    引入 Tailwind 和 Kumo 样式
vite.config.ts        root 是 web/，vite-plugin-singlefile 打成 dist-web/index.html
wrangler.toml         R2 绑定、自定义域名、[[rules]] 把 *.html 当 Text 模块
scripts/kumo-lint.mjs 检查 kumo-design 规则（pnpm lint）
.agents/              规则、提示词、决策记录、kumo-design skill，还有这份文档
```

页面怎么拿数据：页面本身是 Basic 认证后打开的，浏览器会自动给同源请求带上同一组凭据，所以 `dav.ts` 直接 fetch / XHR 同一个域名，不用自己处理密码。

## 五、开发和验证的规矩

1. 包管理只用 pnpm。常用命令：`pnpm build`、`pnpm dev`、`pnpm typecheck`、`pnpm lint`、`pnpm run deploy`。
2. 构建顺序：`src/index.ts` 导入 `dist-web/index.html`，没构建过就没法类型检查和部署。`dev` 和 `deploy` 脚本已经先跑 `vite build`。
3. 部署用 API token：沙箱里跑 `CLOUDFLARE_ACCOUNT_ID=9151f72e404dd53f20b8e6667893237d pnpm run deploy`。Static Assets 上传经 Hark 网关会 401，所以界面必须内联，不要改成 assets。
4. 沙箱内存紧（约 8 GB，没有 swap），`vite build` 曾被系统杀掉（退出码 137）。放后台跑，别同时开别的大进程。
5. 部署后按 `.agents/prompts/regression.md` 回归：PROPFIND 207 多状态、MKCOL 201、PUT 201、GET 下载、MOVE 201、DELETE 204 无内容、无认证 401 未授权、OPTIONS 预检。测试放临时文件夹，测完删掉。
6. 界面改动要截图看明暗两套。Kumo 规则：只用语义色（`bg-kumo-*`、`text-kumo-*`），不写 `dark:`；对话框一直渲染，用 `open` 控制。
7. 每轮改完 commit 并 push 到 `origin main`。提交作者用 `Rei Leo <reiy.leoz@gmail.com>`，提交说明写中文。
8. 中文文档按 zh-writing 写，像人说话；HTTP 状态码后面带中文说明。

## 六、没做完的事

### 等 Rei 动手

- 目前没有。

### 等 Rei 拍板

- 上游 README 里「Usage」一节还写着 `npm run dev`、`npm run deploy`。要不要改成 pnpm？改了以后合并上游时可能冲突，不改又和「只用 pnpm」的约定不一致。我倾向不改上游段落，我们自己的段落已经写了 pnpm。
- 大陆访问：2026-10-26 用 itdog 测过 279 个节点，电信平均 1.6 秒、移动 1.2 秒，联通大多超时（平均 5.4 秒），159 个节点失败。Rei 自己用够了；要给大陆别人用，得考虑换线路或优选 IP。
- 单个文件上传受 Workers 请求体上限约束（免费档约 100 MB），超过会失败。要不要做分片上传（R2 multipart）？

### 我们能做的

- 拖入整个文件夹上传（现在会跳过）。
- 上传超过 100 MB 时在页面上先拦住，给出明确提示，而不是等服务器报错。
- 401 未授权的响应正文现在是英文 `Unauthorized`，可以改成中文（要确认不影响 WebDAV 客户端）。
- 手机窄屏的布局还没专门调过。

## 七、写了但没验证的

- **GitHub 上的 litmus CI**：改成 pnpm 后没看过它在 GitHub 上跑没跑通（当时没去查 Actions 页面，现在 GitHub connector 也断了）。
- **真实 WebDAV 客户端**：界面上线后只用 curl 回归过，没用 Navill 扩展、Finder、rclone 之类真客户端再测一遍。理论上不受影响，因为它们不带 `Accept: text/html`。
- **其他浏览器**：只在无头 Chromium 里测过上传、重命名、删除、进文件夹。Safari、Firefox 弹出 Basic 认证后，XHR 上传和 MOVE 能不能自动带上凭据，没测。
- **大文件**：只传过 3 MB 的文件；接近 100 MB 时的进度和报错没测。
- **在 Rei 自己的浏览器里登录后**的样子没看过，截图都是用代码带认证头拍的。

## 八、仓库外的东西

| 东西 | 在哪 |
|---|---|
| 本地仓库 | `/workspace/projects/2cd14608-4ab7-4c63-b6ce-8f596ecaf79f/work/r2-webdav` |
| 截图 | `/workspace/projects/2cd14608-4ab7-4c63-b6ce-8f596ecaf79f/work/shots/` |
| 截图脚本 | `/workspace/work/pw/shot-r2.mjs`（明暗、菜单、对话框）、`r2-ops.mjs`（上传、重命名、删除）。Chromium 要传 `HTTPS_PROXY` 当代理；Basic 认证用 `extraHTTPHeaders`，`httpCredentials` 会和代理认证冲突 |
| Git 推送密钥 | `/workspace/.ssh/r2-webdav-deploy`（写权限 deploy key，不入库）。推送：`GIT_SSH_COMMAND="ssh -i /workspace/.ssh/r2-webdav-deploy -o IdentitiesOnly=yes" git push origin main` |
| WebDAV 密码 | Worker secret `PASSWORD`，Rei 手上有。Hark vault 里没存，也不要写进仓库或文档 |
| Cloudflare | 账号 `9151f72e404dd53f20b8e6667893237d`，Worker `r2-webdav`，自定义域名 `r.rei8t.dev`，R2 桶 `r2-webdav`。部署用 vault 里的 Cloudflare API token（沙箱通过代理注入） |
| Hark 项目 | r2-webdav（`2cd14608-4ab7-4c63-b6ce-8f596ecaf79f`），项目说明里有同样的路径和约定 |
