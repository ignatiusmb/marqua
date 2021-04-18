import { checkNum } from 'mauss/utils';
import { clean } from './helper';

export function construct(metadata: string) {
	const lines = clean(metadata.split(/\r?\n/));
	if (!lines.length) return {};

	const ignored = ['title', 'description'];
	const traverse = (
		curr: Record<string, any>,
		keys: string[],
		val: string | string[]
	): string | string[] | Record<string, any> => {
		if (!keys.length) return val instanceof Array ? clean(val) : val;
		return { ...curr, [keys[0]]: traverse(curr[keys[0]] || {}, keys.slice(1), val) };
	};

	return lines.reduce((acc: Record<string, any>, cur) => {
		const match = cur.trim().match(/([:\w]+): (.+)/);
		if (!match || (match && !match[2].trim())) return acc;
		const [key, data] = match.slice(1).map((g) => g.trim());
		const val = /,/.test(data) ? data.split(',').map((v) => v.trim()) : data;
		if (/:/.test(key)) {
			const [attr, ...keys] = clean(key.split(':'));
			const initial = ignored.includes(attr) ? data : val;
			acc[attr] = traverse(acc[attr] || {}, keys, initial);
		} else if (ignored.includes(key)) acc[key] = data;
		else acc[key] = val instanceof Array ? clean(val) : val;
		return acc;
	}, {});
}

export function supplant(data: Record<string, any>, content: string): string {
	const traverse = (meta: string | Record<string, any>, properties: string): string => {
		for (const key of properties.split(':'))
			if (typeof meta !== 'string') meta = meta[checkNum(key)];
		return typeof meta === 'string' ? meta : JSON.stringify(meta);
	};

	return content.replace(/!{(.+)}/g, (s, c) => (c && traverse(data, c)) || s);
}
