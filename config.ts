import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/** Key spec for the overlay collapse/expand shortcut, e.g. `"ctrl+]"` or `"alt+o"`. */
export type CollapseKeySpec = string;

export const DEFAULT_COLLAPSE_KEY: CollapseKeySpec = "ctrl+]";
export const COLLAPSE_KEY_OFF: CollapseKeySpec = "off";

export interface GuidanceFields {
	promptSnippet?: string;
	promptGuidelines?: string[];
	description?: string;
}

export interface QuestionUserConfig {
	guidance?: GuidanceFields;
	/**
	 * Key spec for the collapse/expand shortcut, in the same format as pi-coding-agent
	 * keybinding ids (`modifier+key`, e.g. `ctrl+]`, `alt+o`, `ctrl+shift+h`). Defaults
	 * to `"ctrl+]"`. Set this to a key that is reachable on your keyboard layout — Latin
	 * American layouts (where `]` is on the shifted layer) often want `"ctrl+}"` instead.
	 * Pass `"off"` to disable the collapse shortcut entirely.
	 */
	collapseKey?: CollapseKeySpec;
}

// Named keys accepted by pi-tui's `matchesKey` (keys.js switch on the parsed base key).
// parseKeyId lowercases the id before matching, so lowercase spellings are canonical.
const SPECIAL_KEYS = new Set([
	"escape",
	"esc",
	"enter",
	"return",
	"tab",
	"space",
	"backspace",
	"delete",
	"insert",
	"clear",
	"home",
	"end",
	"pageup",
	"pagedown",
	"up",
	"down",
	"left",
	"right",
	...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);

const MODIFIERS = new Set(["ctrl", "shift", "alt", "super"]);

function isValidCollapseKeySpec(spec: string): boolean {
	// Mirror pi-tui's KeyId grammar strictly: zero or more distinct modifiers, then a
	// base key that is a single printable character or a named special key. A loose
	// check is not enough — pi-tui's `parseKeyId` takes the LAST `+`-part as the key
	// and ignores unknown parts, so a typo like `ctr+]` would silently match every
	// bare `]` keypress (and the raw terminal listener would consume them globally).
	if (!spec) return false;
	if (spec.startsWith("+") || spec.endsWith("+") || spec.includes("++")) return false;
	const parts = spec.split("+");
	const base = parts[parts.length - 1] ?? "";
	const modifiers = parts.slice(0, -1);
	if (modifiers.length !== new Set(modifiers).size) return false;
	if (!modifiers.every((m) => MODIFIERS.has(m))) return false;
	return base.length === 1 ? /[a-z0-9_\-!@#$%^&*()|~`'":;,./<>?[\]{}=\\]/.test(base) : SPECIAL_KEYS.has(base);
}

export function resolveCollapseKey(config: Pick<QuestionUserConfig, "collapseKey">): CollapseKeySpec {
	const raw = config.collapseKey?.trim().toLowerCase();
	if (raw === undefined || raw === "") return DEFAULT_COLLAPSE_KEY;
	if (raw === COLLAPSE_KEY_OFF) return COLLAPSE_KEY_OFF;
	return isValidCollapseKeySpec(raw) ? raw : DEFAULT_COLLAPSE_KEY;
}

// The only compound-word names in SPECIAL_KEYS — first-letter capitalization
// alone would render them "Pageup"/"Pagedown".
const COMPOUND_KEY_DISPLAY: Record<string, string> = {
	pageup: "PageUp",
	pagedown: "PageDown",
};

/**
 * Pretty-print a resolved key spec for UI copy: each `+`-part gets its first
 * character uppercased (`"ctrl+]"` → `"Ctrl+]"`, `"alt+o"` → `"Alt+O"`,
 * `"f9"` → `"F9"`, `"ctrl+pagedown"` → `"Ctrl+PageDown"`). Display-only — key
 * matching always uses the raw lowercase spec (`matchesKey` lowercases ids),
 * so never feed the result back into it.
 */
export function formatKeySpecForDisplay(spec: CollapseKeySpec): string {
	return spec
		.split("+")
		.map(
			(part) =>
				COMPOUND_KEY_DISPLAY[part] ??
				(part.length <= 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)),
		)
		.join("+");
}

function expandTilde(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}

function resolveConfigDir(): string {
	const configured = process.env.XDG_CONFIG_HOME?.trim();
	if (!configured) return join(homedir(), ".config");
	const expanded = expandTilde(configured);
	return isAbsolute(expanded) ? expanded : join(homedir(), ".config");
}

function loadJsonConfig<T>(path: string): T {
	if (!existsSync(path)) return {} as T;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {} as T;
		return parsed as T;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`question-user: invalid JSON at ${path}, using defaults ({}) — ${message}`);
		return {} as T;
	}
}

function loadJsonConfigWithLegacyFallback<T>(name: string): T {
	const configPath = join(resolveConfigDir(), name, "config.json");
	if (existsSync(configPath)) return loadJsonConfig<T>(configPath);
	return loadJsonConfig<T>(join(homedir(), ".config", name, "config.json"));
}

export function loadConfig(): QuestionUserConfig {
	return loadJsonConfigWithLegacyFallback<QuestionUserConfig>("question-user");
}

/** Extract only valid guidance overrides from an untrusted config value. */
export function validateGuidanceFields(fields: unknown): GuidanceFields {
	if (!fields || typeof fields !== "object") return {};
	const guidance = fields as Record<string, unknown>;
	const result: GuidanceFields = {};
	if (typeof guidance.promptSnippet === "string" && guidance.promptSnippet.length > 0) {
		result.promptSnippet = guidance.promptSnippet;
	}
	if (
		Array.isArray(guidance.promptGuidelines) &&
		guidance.promptGuidelines.length > 0 &&
		guidance.promptGuidelines.every((value) => typeof value === "string" && value.length > 0)
	) {
		result.promptGuidelines = guidance.promptGuidelines;
	}
	if (typeof guidance.description === "string" && guidance.description.length > 0) {
		result.description = guidance.description;
	}
	return result;
}
