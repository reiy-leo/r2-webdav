// 明暗主题：浅色 / 深色 / 跟随系统。index.html 里的内联脚本先设好 data-mode，这里负责切换。
export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'r2dav-theme';

export const getThemePref = (): ThemePref => {
	const v = localStorage.getItem(KEY);
	return v === 'light' || v === 'dark' ? v : 'system';
};

export function setThemePref(pref: ThemePref) {
	if (pref === 'system') localStorage.removeItem(KEY);
	else localStorage.setItem(KEY, pref);
	const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.dataset.mode = dark ? 'dark' : 'light';
	document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
