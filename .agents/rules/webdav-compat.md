# WebDAV 行为不能动

这个服务给 WebDAV 客户端和 Navill 扩展用，界面只是附带的。

- 只有「浏览器 GET 目录」（`Accept` 里有 `text/html`）才返回 `dist-web/index.html`。其他 GET、HEAD 和全部 WebDAV 方法照旧。
- 不带 `text/html` 的 GET 目录仍回原来的简单链接列表，别删。
- 认证只用 HTTP Basic（用户名 `USERNAME`，密码 `PASSWORD`，都是 Worker secret）。WebDAV 客户端不支持 OAuth，不要改成 Google OAuth。
- CORS 预检（OPTIONS）必须继续放行 PROPFIND、PUT 等全部方法，以及 `Authorization`、`Depth`、`Destination`、`Overwrite` 等头。Navill 扩展靠它同步。
- 改 `src/index.ts` 后跑一遍 litmus（CI 里有）或下面的 curl 回归。
