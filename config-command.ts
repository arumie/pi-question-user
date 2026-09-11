import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
	loadConfig,
	resolveMaxHeaderLength,
	resolveMaxLabelLength,
	resolveMaxOptions,
	resolveMaxQuestions,
	resolveMinOptions,
	resolveMinQuestions,
	resolvePreferredMaxOptions,
	resolveCollapseKey,
	saveConfig,
	validateGuidanceFields,
	type GuidanceFields,
	type QuestionUserConfig,
} from "./config.js";

export const QUESTION_USER_CONFIG_COMMAND = "question-user-config";

type CommandContext = Pick<ExtensionCommandContext, "ui">;

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
		const raw = await ctx.ui.input(
			`${title} (current: ${current})`,
			`Enter an integer from ${minimum} to ${maximum}; leave blank to keep ${current}`,
		);
		if (raw === undefined) return undefined;
		if (raw.trim() === "") return current;

		const parsed = parseInteger(raw, minimum, maximum);
		if (parsed !== undefined) return parsed;
		ctx.ui.notify(`Please enter an integer from ${minimum} to ${maximum}.`, "warning");
	}
}

async function promptEditor(ctx: CommandContext, title: string, current: string): Promise<string | undefined> {
	const value = await ctx.ui.editor(`${title} (blank clears the override)`, current);
	if (value === undefined) return undefined;
	return value.trim() === "" ? "" : value;
}

async function promptCollapseKey(ctx: CommandContext, current: string): Promise<string | undefined> {
	for (;;) {
		const raw = await ctx.ui.input(
			`Collapse key (current: ${current})`,
			`Enter a Pi keybinding such as ctrl+] or off; leave blank to keep ${current}`,
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

function summarizeConfig(config: QuestionUserConfig): string {
	const guidance = config.guidance;
	return [
		`Questions: ${config.minQuestions}-${config.maxQuestions}`,
		`Options: ${config.minOptions}-${config.maxOptions} (prefer ${config.preferredMaxOptions})`,
		`Header length: ${config.maxHeaderLength}`,
		`Option-label length: ${config.maxLabelLength}`,
		`Collapse key: ${config.collapseKey}`,
		`Guidance overrides: ${
			guidance
				? [guidance.description && "description", guidance.promptSnippet && "snippet", guidance.promptGuidelines && "guidelines"]
					.filter(Boolean)
					.join(", ") || "none"
			: "none"
		}`,
	].join("\n");
}

export async function configureQuestionUser(ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("/question-user-config requires an interactive session.", "error");
		return;
	}

	await ctx.waitForIdle();
	const existing = loadConfig();
	const guidance = validateGuidanceFields(existing.guidance);

	const minQuestions = await promptInteger(ctx, "Minimum questions", resolveMinQuestions(existing.minQuestions), 1);
	if (minQuestions === undefined) return;
	const maxQuestions = await promptInteger(
		ctx,
		"Maximum questions",
		resolveMaxQuestions(existing.maxQuestions, minQuestions),
		minQuestions,
	);
	if (maxQuestions === undefined) return;

	const minOptions = await promptInteger(ctx, "Minimum authored options", resolveMinOptions(existing.minOptions), 1);
	if (minOptions === undefined) return;
	const maxOptions = await promptInteger(
		ctx,
		"Maximum authored options",
		resolveMaxOptions(existing.maxOptions, minOptions),
		minOptions,
	);
	if (maxOptions === undefined) return;
	const preferredMaxOptions = await promptInteger(
		ctx,
		"Preferred maximum authored options",
		resolvePreferredMaxOptions(existing.preferredMaxOptions, minOptions, maxOptions),
		minOptions,
		maxOptions,
	);
	if (preferredMaxOptions === undefined) return;

	const maxHeaderLength = await promptInteger(
		ctx,
		"Maximum question-header length",
		resolveMaxHeaderLength(existing.maxHeaderLength),
		1,
	);
	if (maxHeaderLength === undefined) return;
	const maxLabelLength = await promptInteger(
		ctx,
		"Maximum option-label length",
		resolveMaxLabelLength(existing.maxLabelLength),
		1,
	);
	if (maxLabelLength === undefined) return;

	const collapseKey = await promptCollapseKey(ctx, resolveCollapseKey(existing));
	if (collapseKey === undefined) return;

	const description = await promptEditor(ctx, "Tool description override", guidance.description ?? "");
	if (description === undefined) return;
	const promptSnippet = await promptEditor(ctx, "Prompt snippet override", guidance.promptSnippet ?? "");
	if (promptSnippet === undefined) return;
	const promptGuidelinesText = await promptEditor(
		ctx,
		"Prompt guidelines override (one guideline per line)",
		guidance.promptGuidelines?.join("\n") ?? "",
	);
	if (promptGuidelinesText === undefined) return;

	const nextConfig: QuestionUserConfig = {
		minQuestions,
		maxQuestions,
		minOptions,
		maxOptions,
		preferredMaxOptions,
		maxHeaderLength,
		maxLabelLength,
		collapseKey,
		guidance: buildGuidance(description, promptSnippet, promptGuidelinesText),
	};

	if (!(await ctx.ui.confirm("Save question-user configuration?", summarizeConfig(nextConfig)))) return;

	try {
		const configPath = saveConfig(nextConfig);
		ctx.ui.notify(`Saved question-user configuration to ${configPath}. Reloading…`, "info");
		await ctx.reload();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Could not save question-user configuration: ${message}`, "error");
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
