# 工作流程

1. 包管理只用 pnpm，不用 npm。
2. 每轮改完就 commit，并 push 到 `origin main`。
3. 发版、打 tag 之前先问 Rei。
4. 部署：`pnpm run deploy`（先 `vite build` 再 `wrangler deploy`）。用 API token 部署时 Static Assets 上传会 401，所以界面内联进脚本，不要改回 assets。
5. 部署后跑 `.agents/prompts/regression.md` 里的回归。
6. 写中文文档要像人说话：少用被动、别写「进行」「通过」之类空词。HTTP 状态码后面带中文说明，比如「401 未授权」。
7. 别动上游的 `LICENSE`（Apache-2.0）。
