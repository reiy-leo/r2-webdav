// 同源 WebDAV 请求。页面本身就是 Basic 认证后打开的，浏览器会自动带上同一组凭据。

export interface Entry {
	name: string;
	/** 以 / 开头、已编码的路径；文件夹以 / 结尾 */
	href: string;
	isDir: boolean;
	size: number;
	modified: Date | null;
	contentType: string;
}

const STATUS_ZH: Record<number, string> = {
	400: '请求有误',
	401: '未授权',
	403: '禁止访问',
	404: '不存在',
	405: '不允许的方法',
	409: '冲突，上级文件夹不存在',
	412: '前提条件不满足，可能已有同名项',
	413: '文件太大',
	423: '已锁定',
	500: '服务器出错',
	502: '网关出错',
	503: '服务暂不可用',
	507: '存储空间不足',
};

export class DavError extends Error {
	constructor(public status: number) {
		super(status === 0 ? '网络连接失败' : `${status} ${STATUS_ZH[status] ?? '请求失败'}`);
	}
}

/** 把解码后的名字拼到目录路径后面 */
export const childHref = (dirHref: string, name: string, isDir = false) =>
	dirHref + encodeURIComponent(name) + (isDir ? '/' : '');

export const decodeName = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
};

export async function list(dirHref: string): Promise<Entry[]> {
	const res = await fetch(dirHref, {
		method: 'PROPFIND',
		headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
		body: '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>',
		credentials: 'same-origin',
	});
	if (res.status !== 207) throw new DavError(res.status);
	const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
	const self = new URL(dirHref, location.origin).pathname;
	const out: Entry[] = [];
	for (const r of Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))) {
		const rawHref = r.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? '';
		const href = new URL(rawHref, location.origin).pathname;
		if (href === self || href + '/' === self) continue;
		const prop = (n: string) => r.getElementsByTagNameNS('DAV:', n)[0];
		const isDir = !!prop('resourcetype')?.getElementsByTagNameNS('DAV:', 'collection')[0];
		const segs = href.replace(/\/$/, '').split('/');
		const lm = prop('getlastmodified')?.textContent;
		out.push({
			name: decodeName(segs[segs.length - 1] ?? ''),
			href: isDir && !href.endsWith('/') ? href + '/' : href,
			isDir,
			size: Number(prop('getcontentlength')?.textContent ?? 0) || 0,
			modified: lm ? new Date(lm) : null,
			contentType: prop('getcontenttype')?.textContent ?? '',
		});
	}
	return out;
}

async function call(method: string, href: string, headers: Record<string, string> = {}) {
	let res: Response;
	try {
		res = await fetch(href, { method, headers, credentials: 'same-origin' });
	} catch {
		throw new DavError(0);
	}
	if (!res.ok) throw new DavError(res.status);
}

export const mkcol = (href: string) => call('MKCOL', href);
export const remove = (href: string) => call('DELETE', href);
export const move = (from: string, to: string) =>
	call('MOVE', from, { Destination: new URL(to, location.origin).href, Overwrite: 'F' });

/** 用 XHR 上传，好拿到进度 */
export function upload(
	href: string,
	file: File,
	onProgress: (loaded: number) => void,
): { promise: Promise<void>; abort: () => void } {
	const xhr = new XMLHttpRequest();
	const promise = new Promise<void>((resolve, reject) => {
		xhr.open('PUT', href);
		xhr.withCredentials = true;
		if (file.type) xhr.setRequestHeader('Content-Type', file.type);
		xhr.upload.onprogress = (e) => onProgress(e.loaded);
		xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new DavError(xhr.status)));
		xhr.onerror = () => reject(new DavError(0));
		xhr.onabort = () => reject(new Error('已取消'));
		xhr.send(file);
	});
	return { promise, abort: () => xhr.abort() };
}

export function formatSize(n: number): string {
	if (n < 1024) return `${n} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let v = n / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

const fmt = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});
export const formatTime = (d: Date | null) => (d && !isNaN(d.getTime()) ? fmt.format(d) : '—');
