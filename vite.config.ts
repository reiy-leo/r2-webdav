import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 浏览器文件管理页：web/ 打成一个自带 JS/CSS 的 dist-web/index.html，
// Worker 用 Text 模块把它整个内联进脚本（API token 部署时 Static Assets 上传会 401）。
export default defineConfig({
	root: 'web',
	plugins: [react(), tailwindcss(), viteSingleFile()],
	build: {
		outDir: '../dist-web',
		emptyOutDir: true,
		target: 'es2022',
		sourcemap: false,
		chunkSizeWarningLimit: 2000,
	},
});
