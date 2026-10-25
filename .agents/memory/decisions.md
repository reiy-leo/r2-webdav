# 决策记录

- 2026-10-24：在 r.rei8t.dev 部署上游 abersheeran/r2-webdav，R2 桶 `r2-webdav`，用来替代坚果云 WebDAV（限流、应用密码只给客户端用）。
- 2026-10-25：fork 到 reiy-leo/r2-webdav，upstream 保留指向 abersheeran，方便以后合并上游。
- 2026-10-25：网站图标用 https://m.rei8t.dev/i/jTleOJyB.png。
- 2026-10-25：Rei 嫌浏览器目录页太简陋，用 React + Kumo 重做成文件管理界面，图标用 Lucide。Vite 打成单文件 HTML，作为 Text 模块内联进 Worker；只在浏览器 GET 目录时返回。
