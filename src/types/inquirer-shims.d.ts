declare module "@inquirer/core" {
	class Separator {
		constructor(label?: string);
		static isSeparator(item: unknown): item is Separator;
		readonly separator: true;
	}

	export { Separator };
}

declare module "@inquirer/confirm" {
	interface ConfirmOptions {
		readonly message: string;
		readonly default?: boolean;
	}

	function confirm(options: ConfirmOptions): Promise<boolean>;
	export default confirm;
}

declare module "@inquirer/search" {
	interface SearchOptions {
		readonly message: string;
		readonly source: (input?: string) => Promise<readonly unknown[]>;
		readonly pageSize?: number;
	}

	function search(options: SearchOptions): Promise<string>;
	export default search;
}
