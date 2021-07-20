declare const UniqueInput: unique symbol;
declare const UniqueOutput: unique symbol;
export type ParserTypes<Input, Output> = {
	[UniqueInput]: Input;
	[UniqueOutput]: Output;
};

export type FileOptions = {
	entry: string;
	minimal?: boolean;
	exclude?: Array<string>;
};

export type DirOptions<
	Output extends object = {},
	Default = keyof Output extends never ? Record<string, any> : Output
> = FileOptions & {
	entry: string;
	recurse?: boolean;
	extensions?: Array<string>;
	sort?(x: Default, y: Default): number;
	siblings?: {
		item(input: { prev?: Default; next?: Default }): any;
		breakpoint?(next: Default): boolean;
	};
};
