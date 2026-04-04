declare module "@inquirer/checkbox" {
	class Separator {
		constructor(label?: string);
		readonly separator: true;
	}

	interface CheckboxChoice {
		readonly value: string;
		readonly name?: string;
	}

	interface CheckboxOptions {
		readonly message: string;
		readonly choices: readonly (CheckboxChoice | Separator)[];
		readonly pageSize?: number;
	}

	function checkbox(options: CheckboxOptions): Promise<string[]>;
	export { Separator };
	export default checkbox;
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
