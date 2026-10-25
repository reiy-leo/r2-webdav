import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
	Breadcrumbs,
	Button,
	Dialog,
	DropdownMenu,
	Empty,
	Input,
	LayerCard,
	Meter,
	SkeletonLine,
	Table,
	Text,
	useKumoToastManager,
} from '@cloudflare/kumo';
import {
	ArrowDown,
	ArrowUp,
	Copy,
	Download,
	Ellipsis,
	File,
	FileArchive,
	FileAudio,
	FileCode,
	FileImage,
	FileText,
	FileVideo,
	Folder,
	FolderOpen,
	FolderPlus,
	House,
	Monitor,
	Moon,
	Pencil,
	RefreshCw,
	Sun,
	Trash2,
	Upload,
	X,
} from 'lucide-react';
import { childHref, decodeName, DavError, formatSize, formatTime, list, mkcol, move, remove, upload, type Entry } from './dav.ts';
import { getThemePref, setThemePref, type ThemePref } from './theme.ts';

type SortKey = 'name' | 'size' | 'modified';
type UploadItem = {
	id: number;
	name: string;
	size: number;
	loaded: number;
	state: 'uploading' | 'done' | 'error';
	error?: string;
	abort?: () => void;
};

const errText = (e: unknown) => (e instanceof DavError || e instanceof Error ? e.message : String(e));
const dirOf = (pathname: string) => (pathname.endsWith('/') ? pathname : pathname + '/');
const badName = (n: string) => !n.trim() || n.includes('/') || n === '.' || n === '..';

function iconFor(e: Entry) {
	const cls = 'shrink-0';
	if (e.isDir) return <Folder size={18} className={`${cls} text-kumo-brand`} />;
	const t = e.contentType;
	const ext = e.name.split('.').pop()?.toLowerCase() ?? '';
	if (t.startsWith('image/') || /^(png|jpe?g|gif|webp|svg|heic|avif|bmp)$/.test(ext)) return <FileImage size={18} className={cls} />;
	if (t.startsWith('video/') || /^(mp4|mov|mkv|webm|avi)$/.test(ext)) return <FileVideo size={18} className={cls} />;
	if (t.startsWith('audio/') || /^(mp3|m4a|flac|wav|ogg|aac)$/.test(ext)) return <FileAudio size={18} className={cls} />;
	if (/^(zip|rar|7z|tar|gz|tgz|bz2|xz)$/.test(ext)) return <FileArchive size={18} className={cls} />;
	if (/^(js|ts|tsx|jsx|json|html|css|py|go|rs|sh|xml|ya?ml|toml)$/.test(ext)) return <FileCode size={18} className={cls} />;
	if (t.startsWith('text/') || /^(txt|md|pdf|docx?|xlsx?|pptx?|csv|epub)$/.test(ext)) return <FileText size={18} className={cls} />;
	return <File size={18} className={cls} />;
}

function ThemeMenu() {
	const [pref, setPref] = useState<ThemePref>(getThemePref);
	const Current = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
	const pick = (p: ThemePref) => {
		setThemePref(p);
		setPref(p);
	};
	return (
		<DropdownMenu>
			<DropdownMenu.Trigger render={<Button variant="ghost" shape="square" icon={<Current size={16} />} aria-label="明暗主题" />} />
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item icon={<Sun size={16} />} onClick={() => pick('light')}>
					浅色
				</DropdownMenu.Item>
				<DropdownMenu.Item icon={<Moon size={16} />} onClick={() => pick('dark')}>
					深色
				</DropdownMenu.Item>
				<DropdownMenu.Item icon={<Monitor size={16} />} onClick={() => pick('system')}>
					跟随系统
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

function SortHead({ k, sort, onSort, children, className }: { k: SortKey; sort: { key: SortKey; asc: boolean }; onSort: (k: SortKey) => void; children: ReactNode; className?: string }) {
	const active = sort.key === k;
	const Arrow = sort.asc ? ArrowUp : ArrowDown;
	return (
		<Table.Head className={className}>
			<button type="button" className="inline-flex items-center gap-1 hover:text-kumo-default" onClick={() => onSort(k)}>
				{children}
				{active && <Arrow size={14} />}
			</button>
		</Table.Head>
	);
}

export function App() {
	const toast = useKumoToastManager();
	const [path, setPath] = useState(() => dirOf(location.pathname));
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });
	const [uploads, setUploads] = useState<UploadItem[]>([]);
	const [dragging, setDragging] = useState(false);
	const dragDepth = useRef(0);
	const fileInput = useRef<HTMLInputElement>(null);
	const uploadSeq = useRef(0);

	// 对话框状态（对话框一直渲染，用 open 控制）
	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [renaming, setRenaming] = useState<Entry | null>(null);
	const [renameTo, setRenameTo] = useState('');
	const [deleting, setDeleting] = useState<Entry | null>(null);
	const [conflict, setConflict] = useState<{ files: File[]; dup: string[]; dir: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (dir: string) => {
		setLoadError(null);
		try {
			setEntries(await list(dir));
		} catch (e) {
			setEntries([]);
			setLoadError(errText(e));
		}
	}, []);

	useEffect(() => {
		setEntries(null);
		load(path);
		const segs = path.split('/').filter(Boolean);
		document.title = segs.length ? `${decodeName(segs[segs.length - 1]!)} · R2 WebDAV` : 'R2 WebDAV';
	}, [path, load]);

	// 站内文件夹链接不整页刷新，前进后退也跟着变
	useEffect(() => {
		const onPop = () => setPath(dirOf(location.pathname));
		const onClick = (ev: MouseEvent) => {
			if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
			const a = (ev.target as HTMLElement).closest('a');
			if (!a || a.target || a.hasAttribute('download')) return;
			const url = new URL(a.href, location.href);
			if (url.origin !== location.origin || !url.pathname.endsWith('/')) return;
			ev.preventDefault();
			if (url.pathname !== location.pathname) history.pushState(null, '', url.pathname);
			setPath(url.pathname);
		};
		addEventListener('popstate', onPop);
		document.addEventListener('click', onClick);
		return () => {
			removeEventListener('popstate', onPop);
			document.removeEventListener('click', onClick);
		};
	}, []);

	const sorted = useMemo(() => {
		if (!entries) return null;
		const dir = sort.asc ? 1 : -1;
		return [...entries].sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			let c = 0;
			if (sort.key === 'size') c = a.size - b.size;
			else if (sort.key === 'modified') c = (a.modified?.getTime() ?? 0) - (b.modified?.getTime() ?? 0);
			if (c === 0) c = a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
			return c * dir;
		});
	}, [entries, sort]);

	const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === 'name' }));

	const crumbs = useMemo(() => {
		const segs = path.split('/').filter(Boolean);
		return segs.map((s, i) => ({ name: decodeName(s), href: '/' + segs.slice(0, i + 1).join('/') + '/' }));
	}, [path]);

	// ---------- 上传 ----------
	const startUploads = useCallback(
		(files: File[], dir: string) => {
			for (const file of files) {
				const id = ++uploadSeq.current;
				const task = upload(childHref(dir, file.name), file, (loaded) =>
					setUploads((u) => u.map((x) => (x.id === id ? { ...x, loaded } : x))),
				);
				setUploads((u) => [...u, { id, name: file.name, size: file.size, loaded: 0, state: 'uploading', abort: task.abort }]);
				task.promise
					.then(() => {
						setUploads((u) => u.map((x) => (x.id === id ? { ...x, loaded: x.size, state: 'done' } : x)));
						if (dirOf(location.pathname) === dir) load(dir);
					})
					.catch((e) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, state: 'error', error: errText(e) } : x))));
			}
		},
		[load],
	);

	const queueFiles = (files: File[]) => {
		if (!files.length) return;
		const names = new Set((entries ?? []).map((e) => e.name));
		const dup = files.filter((f) => names.has(f.name)).map((f) => f.name);
		if (dup.length) setConflict({ files, dup, dir: path });
		else startUploads(files, path);
	};

	const dropHandlers = {
		onDragEnter: (e: React.DragEvent) => {
			if (!e.dataTransfer.types.includes('Files')) return;
			e.preventDefault();
			dragDepth.current++;
			setDragging(true);
		},
		onDragOver: (e: React.DragEvent) => {
			if (e.dataTransfer.types.includes('Files')) e.preventDefault();
		},
		onDragLeave: () => {
			dragDepth.current = Math.max(0, dragDepth.current - 1);
			if (dragDepth.current === 0) setDragging(false);
		},
		onDrop: (e: React.DragEvent) => {
			e.preventDefault();
			dragDepth.current = 0;
			setDragging(false);
			const items = Array.from(e.dataTransfer.items);
			const files = Array.from(e.dataTransfer.files).filter((_, i) => !items[i]?.webkitGetAsEntry()?.isDirectory);
			if (files.length < e.dataTransfer.files.length) toast.add({ title: '暂不支持拖入整个文件夹，已跳过', variant: 'error' });
			queueFiles(files);
		},
	};

	// ---------- 其他操作 ----------
	const run = async (fn: () => Promise<void>, ok: string, close: () => void) => {
		setBusy(true);
		try {
			await fn();
			toast.add({ title: ok, variant: 'success' });
			close();
			load(path);
		} catch (e) {
			toast.add({ title: errText(e), variant: 'error' });
		} finally {
			setBusy(false);
		}
	};

	const createFolder = () => {
		const name = newFolderName.trim();
		if (badName(name)) return;
		if (entries?.some((e) => e.name === name)) {
			toast.add({ title: `「${name}」已存在`, variant: 'error' });
			return;
		}
		run(() => mkcol(childHref(path, name, true)), `已新建「${name}」`, () => setNewFolderOpen(false));
	};

	const doRename = () => {
		const e = renaming;
		const name = renameTo.trim();
		if (!e || badName(name) || name === e.name) return;
		run(() => move(e.href, childHref(path, name, e.isDir)), `已改名为「${name}」`, () => setRenaming(null));
	};

	const doDelete = () => {
		const e = deleting;
		if (!e) return;
		run(() => remove(e.href), `已删除「${e.name}」`, () => setDeleting(null));
	};

	const copyLink = (e: Entry) =>
		navigator.clipboard.writeText(location.origin + e.href).then(() => toast.add({ title: '链接已复制', variant: 'success' }));

	const fileCount = entries?.filter((e) => !e.isDir).length ?? 0;
	const dirCount = entries?.filter((e) => e.isDir).length ?? 0;
	const totalSize = entries?.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0) ?? 0;
	const activeUploads = uploads.filter((u) => u.state === 'uploading').length;

	return (
		<div className="relative min-h-screen" {...dropHandlers}>
			<header className="sticky top-0 z-10 border-b border-kumo-line bg-kumo-canvas">
				<div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
					<a href="/" className="flex items-center gap-2">
						<img src="https://m.rei8t.dev/i/jTleOJyB.png" alt="" className="size-7 rounded-md" />
						<Text as="h1" variant="heading3">
							R2 WebDAV
						</Text>
					</a>
					<div className="flex-1" />
					<Button
						variant="ghost"
						size="sm"
						icon={<Copy size={14} />}
						onClick={() => navigator.clipboard.writeText(location.origin + '/').then(() => toast.add({ title: 'WebDAV 地址已复制', variant: 'success' }))}
					>
						<span className="font-mono text-[0.9em]">{location.host}</span>
					</Button>
					<ThemeMenu />
				</div>
			</header>

			<main className="mx-auto grid max-w-5xl gap-4 px-4 py-5">
				<div className="flex flex-wrap items-center gap-2">
					<div className="min-w-0 flex-1">
						<Breadcrumbs size="sm">
							{crumbs.length === 0 ? (
								<Breadcrumbs.Current icon={<House size={14} />}>全部文件</Breadcrumbs.Current>
							) : (
								<Breadcrumbs.Link href="/" icon={<House size={14} />}>
									全部文件
								</Breadcrumbs.Link>
							)}
							{crumbs.map((c, i) => [
								<Breadcrumbs.Separator key={`s${i}`} />,
								i === crumbs.length - 1 ? (
									<Breadcrumbs.Current key={c.href}>{c.name}</Breadcrumbs.Current>
								) : (
									<Breadcrumbs.Link key={c.href} href={c.href}>
										{c.name}
									</Breadcrumbs.Link>
								),
							])}
						</Breadcrumbs>
					</div>
					<Button variant="ghost" shape="square" icon={<RefreshCw size={16} />} aria-label="刷新" onClick={() => load(path)} />
					<Button
						variant="secondary"
						icon={<FolderPlus size={16} />}
						onClick={() => {
							setNewFolderName('');
							setNewFolderOpen(true);
						}}
					>
						新建文件夹
					</Button>
					<Button variant="primary" icon={<Upload size={16} />} onClick={() => fileInput.current?.click()}>
						上传
					</Button>
					<input
						ref={fileInput}
						type="file"
						multiple
						hidden
						onChange={(e) => {
							queueFiles(Array.from(e.target.files ?? []));
							e.target.value = '';
						}}
					/>
				</div>

				<LayerCard>
					<LayerCard.Primary className="p-0">
						{loadError ? (
							<Empty
								icon={<FolderOpen size={40} className="text-kumo-inactive" />}
								title="打不开这个文件夹"
								description={loadError}
								contents={
									<Button variant="secondary" onClick={() => load(path)}>
										重试
									</Button>
								}
							/>
						) : sorted === null ? (
							<div className="grid gap-3 px-5 py-4">
								{[0, 1, 2, 3].map((i) => (
									<SkeletonLine key={i} />
								))}
							</div>
						) : sorted.length === 0 ? (
							<Empty
								icon={<FolderOpen size={40} className="text-kumo-inactive" />}
								title="这里还是空的"
								description="把文件拖进来，或者点「上传」。"
							/>
						) : (
							<Table>
								<Table.Header>
									<Table.Row>
										<SortHead k="name" sort={sort} onSort={onSort}>
											名称
										</SortHead>
										<SortHead k="size" sort={sort} onSort={onSort} className="w-28 text-right">
											大小
										</SortHead>
										<SortHead k="modified" sort={sort} onSort={onSort} className="hidden w-44 sm:table-cell">
											修改时间
										</SortHead>
										<Table.Head className="w-12" />
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{sorted.map((e) => (
										<Table.Row key={e.href}>
											<Table.Cell className="max-w-0">
												<a
													href={e.href}
													target={e.isDir ? undefined : '_blank'}
													rel="noreferrer"
													className="flex min-w-0 items-center gap-2.5 hover:underline"
													title={e.name}
												>
													{iconFor(e)}
													<span className="truncate">{e.name}</span>
												</a>
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap text-right text-kumo-subtle tabular-nums">
												{e.isDir ? '—' : formatSize(e.size)}
											</Table.Cell>
											<Table.Cell className="hidden whitespace-nowrap text-kumo-subtle tabular-nums sm:table-cell">
												{e.isDir ? '—' : formatTime(e.modified)}
											</Table.Cell>
											<Table.Cell>
												<DropdownMenu>
													<DropdownMenu.Trigger
														render={<Button size="sm" variant="ghost" shape="square" icon={<Ellipsis size={16} />} aria-label={`${e.name} 的操作`} />}
													/>
													<DropdownMenu.Content align="end">
														{!e.isDir && (
															<DropdownMenu.Item
																icon={<Download size={16} />}
																onClick={() => {
																	const a = document.createElement('a');
																	a.href = e.href;
																	a.download = e.name;
																	a.click();
																}}
															>
																下载
															</DropdownMenu.Item>
														)}
														<DropdownMenu.Item icon={<Copy size={16} />} onClick={() => copyLink(e)}>
															复制链接
														</DropdownMenu.Item>
														<DropdownMenu.Item
															icon={<Pencil size={16} />}
															onClick={() => {
																setRenameTo(e.name);
																setRenaming(e);
															}}
														>
															重命名
														</DropdownMenu.Item>
														<DropdownMenu.Separator />
														<DropdownMenu.Item icon={<Trash2 size={16} />} variant="danger" onClick={() => setDeleting(e)}>
															删除
														</DropdownMenu.Item>
													</DropdownMenu.Content>
												</DropdownMenu>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						)}
					</LayerCard.Primary>
				</LayerCard>

				{entries && entries.length > 0 && (
					<Text variant="secondary">
						{dirCount > 0 && `${dirCount} 个文件夹`}
						{dirCount > 0 && fileCount > 0 && '，'}
						{fileCount > 0 && `${fileCount} 个文件，共 ${formatSize(totalSize)}`}
					</Text>
				)}
			</main>

			{/* 拖拽上传时的整页提示 */}
			{dragging && (
				<div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-kumo-canvas/80">
					<div className="flex flex-col items-center gap-2 rounded-xl px-10 py-8 ring-2 ring-kumo-brand">
						<Upload size={32} className="text-kumo-brand" />
						<Text bold>松开就上传到「{crumbs.at(-1)?.name ?? '全部文件'}」</Text>
					</div>
				</div>
			)}

			{/* 上传进度 */}
			{uploads.length > 0 && (
				<div className="fixed right-4 bottom-4 z-30 w-80 max-w-[calc(100vw-2rem)]">
					<LayerCard className="shadow-lg ring ring-kumo-line">
						<LayerCard.Secondary className="flex items-center justify-between px-4 py-2.5">
							<Text bold>{activeUploads > 0 ? `正在上传 ${activeUploads} 个文件` : '上传完成'}</Text>
							<Button
								size="sm"
								variant="ghost"
								shape="square"
								icon={<X size={14} />}
								aria-label={activeUploads > 0 ? '取消全部并关闭' : '关闭'}
								onClick={() => {
									uploads.forEach((u) => u.state === 'uploading' && u.abort?.());
									setUploads([]);
								}}
							/>
						</LayerCard.Secondary>
						<LayerCard.Primary className="grid max-h-72 gap-3 overflow-y-auto px-4 py-3">
							{uploads.map((u) => (
								<div key={u.id} className="grid gap-1">
									<Meter
										label={u.name}
										value={u.size ? (u.loaded / u.size) * 100 : 100}
										customValue={u.state === 'done' ? '完成' : u.state === 'error' ? '失败' : `${formatSize(u.loaded)} / ${formatSize(u.size)}`}
									/>
									{u.error && (
										<Text variant="error" size="xs">
											{u.error}
										</Text>
									)}
								</div>
							))}
						</LayerCard.Primary>
					</LayerCard>
				</div>
			)}

			{/* 新建文件夹 */}
			<Dialog.Root open={newFolderOpen} onOpenChange={setNewFolderOpen}>
				<Dialog size="base" className="px-6 py-5">
					<form
						className="grid gap-5"
						onSubmit={(ev) => {
							ev.preventDefault();
							createFolder();
						}}
					>
						<Dialog.Title className="text-base font-semibold">新建文件夹</Dialog.Title>
						<Input label="名称" autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="比如：照片" />
						<div className="flex justify-end gap-2">
							<Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
							<Button type="submit" variant="primary" loading={busy} disabled={badName(newFolderName)}>
								新建
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* 重命名 */}
			<Dialog.Root open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
				<Dialog size="base" className="px-6 py-5">
					<form
						className="grid gap-5"
						onSubmit={(ev) => {
							ev.preventDefault();
							doRename();
						}}
					>
						<Dialog.Title className="text-base font-semibold">重命名</Dialog.Title>
						<Input label="新名称" autoFocus value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
						<div className="flex justify-end gap-2">
							<Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
							<Button type="submit" variant="primary" loading={busy} disabled={badName(renameTo) || renameTo.trim() === renaming?.name}>
								保存
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* 删除确认 */}
			<Dialog.Root open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
				<Dialog size="base" className="px-6 py-5">
					<div className="grid gap-5">
						<div className="grid gap-1.5">
							<Dialog.Title className="text-base font-semibold">删除「{deleting?.name}」？</Dialog.Title>
							<Dialog.Description className="text-kumo-subtle">
								{deleting?.isDir ? '文件夹里的所有内容会一起删掉，' : ''}删了就找不回来了。
							</Dialog.Description>
						</div>
						<div className="flex justify-end gap-2">
							<Dialog.Close render={(p) => <Button {...p} variant="secondary">取消</Button>} />
							<Button variant="destructive" loading={busy} onClick={doDelete}>
								删除
							</Button>
						</div>
					</div>
				</Dialog>
			</Dialog.Root>

			{/* 同名文件 */}
			<Dialog.Root open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
				<Dialog size="base" className="px-6 py-5">
					<div className="grid gap-5">
						<div className="grid gap-1.5">
							<Dialog.Title className="text-base font-semibold">有 {conflict?.dup.length} 个文件已存在</Dialog.Title>
							<Dialog.Description className="text-kumo-subtle">
								{conflict?.dup.slice(0, 5).join('、')}
								{(conflict?.dup.length ?? 0) > 5 ? ' 等' : ''}。覆盖会替换掉原来的文件。
							</Dialog.Description>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="secondary"
								onClick={() => {
									if (!conflict) return;
									const rest = conflict.files.filter((f) => !conflict.dup.includes(f.name));
									startUploads(rest, conflict.dir);
									setConflict(null);
								}}
							>
								跳过这些
							</Button>
							<Button
								variant="primary"
								onClick={() => {
									if (!conflict) return;
									startUploads(conflict.files, conflict.dir);
									setConflict(null);
								}}
							>
								全部覆盖
							</Button>
						</div>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
