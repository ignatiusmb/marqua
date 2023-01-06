import type { MarquaTable } from '../types.js';
import * as fs from 'fs';
import { marker } from '../artisan/index.js';
import { parse } from '../core/index.js';

interface FrontMatter {
	date: {
		published?: string | Date;
		updated?: string | Date;
	};

	//----> computed properties
	estimate: number;
	table: MarquaTable[];
}

interface Compiled extends FrontMatter {
	content: string;
}

export function compile<Input extends object, Output extends Compiled = Compiled & Input>(
	entry: string,
	hydrate?: (chunk: {
		breadcrumb: string[];
		content: string;
		frontMatter: [keyof Input] extends [never]
			? FrontMatter & Record<string, any>
			: Omit<FrontMatter, keyof Input> & Input;
	}) => undefined | Output
): undefined | Output {
	const crude = fs.readFileSync(entry, 'utf-8').trim();
	const { content: source, metadata } = parse(crude);
	const breadcrumb = entry.split(/[/\\]/).reverse();
	const result = !hydrate
		? ({ ...metadata, content: source } as Compiled)
		: hydrate({ breadcrumb, content: source, frontMatter: metadata as any });

	if (!result /* hydrate is used and returns nothing */) return;
	if (result.date && typeof result.date !== 'string') {
		result.date.updated = result.date.updated || result.date.published;
	}
	if (result.content && typeof result.content === 'string') {
		result.content = marker.render(result.content);
	}

	return result as Output;
}

interface TraverseOptions<Output extends object = {}> {
	entry: string;
	extensions?: string[];
	depth?: number;

	sort?(
		x: [keyof Output] extends [never] ? Record<string, any> : Output,
		y: [keyof Output] extends [never] ? Record<string, any> : Output
	): number;
}

export function traverse<
	Options extends TraverseOptions<Output>,
	Input extends object,
	Output extends Compiled = Compiled & Input,
	Transformed = Output[]
>(
	{ entry, extensions = ['.md'], depth = 0 }: Options,
	hydrate?: Parameters<typeof compile>[1],
	transform?: (items: Output[]) => Transformed
): Transformed {
	if (!fs.existsSync(entry)) {
		console.warn(`Skipping "${entry}", path does not exists`);
		return transform ? transform([]) : ([] as Transformed);
	}

	const backpack = fs.readdirSync(entry).flatMap((name) => {
		const pathname = join(entry, name);
		if (depth !== 0 && fs.lstatSync(pathname).isDirectory()) {
			return traverse({ entry: pathname, extensions, depth: depth - 1 }, hydrate);
		}
		if (extensions.some((e) => name.endsWith(e))) {
			return compile(pathname, hydrate);
		}
		return;
	});

	const items = backpack.filter(
		(i): i is Output => !!(i && (Array.isArray(i) ? i : Object.keys(i)).length)
	);

	return transform ? transform(items) : (items as Transformed);

	// adapted from https://github.com/alchemauss/mauss/pull/153
	function join(...paths: string[]) {
		if (!paths.length) return '.';
		const index = paths[0].replace(/\\/g, '/').trim();
		if (paths.length === 1 && index === '') return '.';
		const parts = index.replace(/[/]*$/g, '').split('/');
		if (parts[0] === '') parts.shift();

		for (let i = 1; i < paths.length; i += 1) {
			const part = paths[i].replace(/\\/g, '/').trim();
			for (const slice of part.split('/')) {
				if (slice === '.') continue;
				if (slice === '..') parts.pop();
				else if (slice) parts.push(slice);
			}
		}

		return (index[0] === '/' ? '/' : '') + parts.join('/');
	}
}
