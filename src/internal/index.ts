import type { DirOptions, FileOptions, HydrateFn } from './types';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

import { readTime, structure, table } from './compute';
import { construct, supplant } from './utils';

export async function compile<I, O extends Record<string, any> = I>(
	options: string | FileOptions,
	hydrate?: HydrateFn<I, O>
): Promise<O | undefined> {
	const { entry, minimal = !1, exclude = [] } =
		typeof options !== 'string' ? options : { entry: options };

	if (!existsSync(entry)) {
		console.warn(`Skipping "${entry}", path does not exists`);
		return;
	}

	const crude = (await fs.readFile(entry, 'utf-8')).trim();
	const match = crude.match(/---\r?\n([\s\S]+?)\r?\n---/);
	const breadcrumb = entry.split(/[/\\]/);

	const metadata = construct((match && match[1].trim()) || '');
	const sliceIdx = match ? (match.index || 0) + match[0].length + 1 : 0;
	const content = supplant(metadata, crude.slice(sliceIdx));
	if (!minimal) {
		if (!exclude.includes('toc')) metadata.toc = table(content);
		if (!exclude.includes('rt')) metadata.read_time = readTime(content);
	}
	const result = !hydrate
		? ({ ...metadata, content } as Record<string, any>)
		: hydrate({ frontMatter: <I>metadata, content, breadcrumb });

	if (!result /* hydrate is used and returns undefined */) return;

	if (!minimal && result.date && typeof result.date !== 'string' && !exclude.includes('date'))
		result.date.updated = result.date.updated || result.date.published;
	if (result.content && typeof result.content === 'string')
		result.content = structure(result.content, minimal || exclude.includes('cnt'));
	return result as O;
}

export async function traverse<I, O extends Record<string, any> = I>(
	options: string | DirOptions,
	hydrate?: HydrateFn<I, O>
): Promise<Array<O>> {
	const { entry, recurse = !1, extensions = ['.md'], ...config } =
		typeof options !== 'string' ? options : { entry: options };

	if (!existsSync(entry)) {
		console.warn(`Skipping "${entry}", path does not exists`);
		return [];
	}

	const initial = await fs.readdir(entry);
	const backpack = await Promise.all(
		initial.map(async (name) => {
			const pathname = path.join(entry, name);
			const status = await fs.stat(pathname);
			const opts = { entry: pathname, recurse, extensions, ...config };
			if (recurse && status.isDirectory()) return traverse(opts, hydrate);
			else if (extensions.some((e) => name.endsWith(e))) return compile(opts, hydrate);
			else return;
		})
	);

	return (recurse ? backpack.flat(Number.POSITIVE_INFINITY) : backpack).filter(
		(i): i is O => !!i && (typeof i.length === 'undefined' || !!i.length)
	);
}
