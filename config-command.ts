import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
	Key,
	SelectList,
	matchesKey,
	truncateToWidth,
	type SelectItem,
	type TuiMouseEvent,
	type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import {
	loadConfig,
	resolveCollapseKey,
	resolveMaxHeaderLength,
	resolveMaxLabelLength,
	resolveMaxOptions,
	resolveMaxQuestions,
	resolveMinOptions,
	resolveMinQuestions,
	resolvePreferredMaxOptions,
	saveConfig,
	validateGuidanceFields,
	type GuidanceFields,
	type QuestionUserConfig,
} from "./config.js";

export const QUESTION_USER_CONFIG_COMMAND = "question-user-config";

type CommandContext = Pick<ExtensionCommandContext, "ui">;

type ConfigChoice =
	| "minQuestions"
	| "maxQuestions"
	| "minOptions"
	| "maxOptions"
	| "preferredMaxOptions"
	| "maxHeaderLength"
	| "maxLabelLength"
	| "collapseKey"
	| "description"
	| "promptSnippet"
	| "promptGuidelines";

type ConfigMenuResult = ConfigChoice | "save" | undefined;

interface DraftConfig {
	minQuestions: number;
	maxQuestions: number;
	minOptions: number;
	maxOptions: number;
	preferredMaxOptions: number;
	maxHeaderLength: number;
	maxLabelLength: number;
	collapseKey: string;
	description: string;
	promptSnippet: string;
	promptGuidelinesText: string;
}

function parseInteger(value: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
	const parsed = Number(value.trim());
	return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

async function promptInteger(
	ctx: CommandContext,
	title: string,
	current: number,
	minimum: number,
	maximum = Number.MAX_SAFE_INTEGER,
): Promise<number | undefined> {
	for (;;) {
		const range = maximum === Number.MAX_SAFE_INTEGER ? `at least ${minimum}` : `${minimum} to ${maximum}`;
		const raw = await ctx.ui.input(
			`${title} (current: ${current})`,
			`Enter an integer ${range}; leave blank to keep ${current}; Esc returns to the settings list`,
		);
		if (raw === undefined) return undefined;
		if (raw.trim() === "") return current;

		const parsed = parseInteger(raw, minimum, maximum);
		if (parsed !== undefined) return parsed;
		ctx.ui.notify(`Please enter an integer ${range}.`, "warning");
	}
}

async function promptEditor(ctx: CommandContext, title: string, current: string): Promise<string | undefined> {
	const value = await ctx.ui.editor(`${title} (blank clears; Esc returns to the settings list)`, current);
	if (value === undefined) return undefined;
	return value.trim() === "" ? "" : value;
}

async function promptCollapseKey(ctx: CommandContext, current: string): Promise<string | undefined> {
	for (;;) {
		const raw = await ctx.ui.input(
			`Collapse key (current: ${current})`,
			`Enter a Pi keybinding such as ctrl+] or off; leave blank to keep ${current}; Esc returns to the settings list`,
		);
		if (raw === undefined) return undefined;
		if (raw.trim() === "") return current;

		const candidate = raw.trim().toLowerCase();
		const resolved = resolveCollapseKey({ collapseKey: candidate });
		if (resolved === candidate) return resolved;
		ctx.ui.notify("Invalid keybinding. Use a Pi keybinding such as ctrl+] or off.", "warning");
	}
}

function parseGuidelines(value: string): string[] | undefined {
	const lines = value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	return lines.length > 0 ? lines : undefined;
}

function buildGuidance(
	description: string,
	promptSnippet: string,
	promptGuidelinesText: string,
): GuidanceFields | undefined {
	const guidance: GuidanceFields = {};
	if (description.trim() !== "") guidance.description = description;
	if (promptSnippet.trim() !== "") guidance.promptSnippet = promptSnippet;
	const promptGuidelines = parseGuidelines(promptGuidelinesText);
	if (promptGuidelines) guidance.promptGuidelines = promptGuidelines;
	return Object.keys(guidance).length > 0 ? guidance : undefined;
}

function createDraft(existing: QuestionUserConfig): DraftConfig {
	const guidance = validateGuidanceFields(existing.guidance);
	const minQuestions = resolveMinQuestions(existing.minQuestions);
	const maxQuestions = resolveMaxQuestions(existing.maxQuestions, minQuestions);
	const minOptions = resolveMinOptions(existing.minOptions);
	const maxOptions = resolveMaxOptions(existing.maxOptions, minOptions);

	return {
		minQuestions,
		maxQuestions,
		minOptions,
		maxOptions,
		preferredMaxOptions: resolvePreferredMaxOptions(existing.preferredMaxOptions, minOptions, maxOptions),
		maxHeaderLength: resolveMaxHeaderLength(existing.maxHeaderLength),
		maxLabelLength: resolveMaxLabelLength(existing.maxLabelLength),
		collapseKey: resolveCollapseKey(existing),
		description: guidance.description ?? "",
		promptSnippet: guidance.promptSnippet ?? "",
		promptGuidelinesText: guidance.promptGuidelines?.join("\n") ?? "",
	};
}

function toConfig(draft: DraftConfig): QuestionUserConfig {
	return {
		minQuestions: draft.minQuestions,
		maxQuestions: draft.maxQuestions,
		minOptions: draft.minOptions,
		maxOptions: draft.maxOptions,
		preferredMaxOptions: draft.preferredMaxOptions,
		maxHeaderLength: draft.maxHeaderLength,
		maxLabelLength: draft.maxLabelLength,
		collapseKey: draft.collapseKey,
		guidance: buildGuidance(draft.description, draft.promptSnippet, draft.promptGuidelinesText),
	};
}

function buildChoices(draft: DraftConfig): Array<{ id: ConfigChoice; label: string }> {
	return [
		{ id: "minQuestions", label: `Minimum questions (${draft.minQuestions})` },
		{ id: "maxQuestions", label: `Maximum questions (${draft.maxQuestions})` },
		{ id: "minOptions", label: `Minimum authored options (${draft.minOptions})` },
		{ id: "maxOptions", label: `Maximum authored options (${draft.maxOptions})` },
		{ id: "preferredMaxOptions", label: `Preferred maximum authored options (${draft.preferredMaxOptions})` },
		{ id: "maxHeaderLength", label: `Maximum question-header length (${draft.maxHeaderLength})` },
		{ id: "maxLabelLength", label: `Maximum option-label length (${draft.maxLabelLength})` },
		{ id: "collapseKey", label: `Collapse key (${draft.collapseKey})` },
		{ id: "description", label: `Tool description override (${draft.description ? "custom" : "built-in"})` },
		{ id: "promptSnippet", label: `Prompt snippet override (${draft.promptSnippet ? "custom" : "built-in"})` },
		{
			id: "promptGuidelines",
			label: `Prompt guidelines override (${draft.promptGuidelinesText ? "custom" : "built-in"})`,
		},
	];
}

async function showConfigMenu(
	ctx: ExtensionCommandContext,
	draft: DraftConfig,
	selectedId: ConfigChoice | undefined,
): Promise<ConfigMenuResult> {
	const choices = buildChoices(draft);
	const items: SelectItem[] = choices.map((choice) => ({ value: choice.id, label: choice.label }));

	return ctx.ui.custom<ConfigMenuResult>((tui, theme, _keybindings, done) => {
		const list = new SelectList(items, Math.min(items.length, 12), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});
		const selectedIndex = selectedId === undefined ? -1 : choices.findIndex((choice) => choice.id === selectedId);
		if (selectedIndex >= 0) list.setSelectedIndex(selectedIndex);

		list.onSelect = (item) => done(item.value as ConfigChoice);
		list.onCancel = () => done(undefined);

		return {
			render(width: number): string[] {
				return [
					...list.render(width),
					"",
					theme.fg("dim", truncateToWidth("  Enter edit · Ctrl+S save · Esc cancel", width)),
				];
			},
			handleInput(data: string): void {
				if (matchesKey(data, Key.ctrl("s"))) {
					done("save");
					return;
				}
				list.handleInput(data);
				tui.requestRender();
			},
			handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
				return list.handleMouse(event);
			},
			invalidate(): void {
				list.invalidate();
			},
		};
	});
}

async function editChoice(ctx: ExtensionCommandContext, draft: DraftConfig, choice: ConfigChoice): Promise<boolean> {
	switch (choice) {
		case "minQuestions": {
			const value = await promptInteger(ctx, "Minimum questions", draft.minQuestions, 1);
			if (value === undefined) return false;
			draft.minQuestions = value;
			if (draft.maxQuestions < value) draft.maxQuestions = value;
			return true;
		}
		case "maxQuestions": {
			const value = await promptInteger(ctx, "Maximum questions", draft.maxQuestions, draft.minQuestions);
			if (value === undefined) return false;
			draft.maxQuestions = value;
			return true;
		}
		case "minOptions": {
			const value = await promptInteger(ctx, "Minimum authored options", draft.minOptions, 1);
			if (value === undefined) return false;
			draft.minOptions = value;
			if (draft.maxOptions < value) draft.maxOptions = value;
			draft.preferredMaxOptions = Math.max(value, Math.min(draft.preferredMaxOptions, draft.maxOptions));
			return true;
		}
		case "maxOptions": {
			const value = await promptInteger(ctx, "Maximum authored options", draft.maxOptions, draft.minOptions);
			if (value === undefined) return false;
			draft.maxOptions = value;
			draft.preferredMaxOptions = Math.min(draft.preferredMaxOptions, value);
			return true;
		}
		case "preferredMaxOptions": {
			const value = await promptInteger(
				ctx,
				"Preferred maximum authored options",
				draft.preferredMaxOptions,
				draft.minOptions,
				draft.maxOptions,
			);
			if (value === undefined) return false;
			draft.preferredMaxOptions = value;
			return true;
		}
		case "maxHeaderLength": {
			const value = await promptInteger(ctx, "Maximum question-header length", draft.maxHeaderLength, 1);
			if (value === undefined) return false;
			draft.maxHeaderLength = value;
			return true;
		}
		case "maxLabelLength": {
			const value = await promptInteger(ctx, "Maximum option-label length", draft.maxLabelLength, 1);
			if (value === undefined) return false;
			draft.maxLabelLength = value;
			return true;
		}
		case "collapseKey": {
			const value = await promptCollapseKey(ctx, draft.collapseKey);
			if (value === undefined) return false;
			draft.collapseKey = value;
			return true;
		}
		case "description": {
			const value = await promptEditor(ctx, "Tool description override", draft.description);
			if (value === undefined) return false;
			draft.description = value;
			return true;
		}
		case "promptSnippet": {
			const value = await promptEditor(ctx, "Prompt snippet override", draft.promptSnippet);
			if (value === undefined) return false;
			draft.promptSnippet = value;
			return true;
		}
		case "promptGuidelines": {
			const value = await promptEditor(
				ctx,
				"Prompt guidelines override (one guideline per line)",
				draft.promptGuidelinesText,
			);
			if (value === undefined) return false;
			draft.promptGuidelinesText = value;
			return true;
		}
	}
}

export async function configureQuestionUser(ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("/question-user-config requires an interactive session.", "error");
		return;
	}

	await ctx.waitForIdle();
	const draft = createDraft(loadConfig());
	let selectedId: ConfigChoice | undefined;

	for (;;) {
		const selected = await showConfigMenu(ctx, draft, selectedId);
		if (selected === undefined) return;
		if (selected === "save") {
			try {
				const configPath = saveConfig(toConfig(draft));
				ctx.ui.notify(`Saved question-user configuration to ${configPath}. Reloading…`, "info");
				await ctx.reload();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Could not save question-user configuration: ${message}`, "error");
				continue;
			}
			return;
		}

		selectedId = selected;
		if (!(await editChoice(ctx, draft, selected))) continue;
	}
}

export function registerQuestionUserConfigCommand(pi: ExtensionAPI): void {
	pi.registerCommand(QUESTION_USER_CONFIG_COMMAND, {
		description: "Configure question-user limits, keybindings, and prompt guidance",
		handler: async (_args, ctx) => {
			await configureQuestionUser(ctx);
		},
	});
}
