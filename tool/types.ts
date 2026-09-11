import { type Static, Type } from "typebox";
import { LABELS_BY_KIND, ROW_INTENT_META } from "../state/row-intent.js";

export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 4;
export const MIN_OPTIONS = 2;
export const PREFERRED_MAX_OPTIONS = 4;
export const MAX_OPTIONS = 12;
export const MAX_HEADER_LENGTH = 50;
export const MAX_LABEL_LENGTH = 200;

/**
 * User-facing labels for the three runtime sentinel rows, keyed by their
 * `WrappingSelectItem.kind` discriminator. Sourced from
 * `ROW_INTENT_META` via `LABELS_BY_KIND` (`row-intent.ts`) — single source of
 * truth. Adding a new sentinel requires extending the `WrappingSelectItem`
 * union AND adding an entry to `ROW_INTENT_META`; this map then auto-extends.
 */
export const SENTINEL_LABELS = LABELS_BY_KIND;

export type SentinelKind = keyof typeof SENTINEL_LABELS;
export type SentinelLabel = (typeof SENTINEL_LABELS)[SentinelKind];

/**
 * Labels reserved for Pi-internal sentinels — authoring an option with any
 * of these labels triggers the `reserved_label` runtime guard. Two of the
 * three come from `ROW_INTENT_META` (the runtime kinds); `"Other"` is
 * reserved for CC parity only (the model is conditioned to reach for
 * "Other" in CC; we reject it so the runtime sentinel is the single source
 * of truth) and has no runtime kind.
 *
 * Reserved unconditionally — every question mode rejects these labels, even
 * when a given runtime sentinel is not appended in that mode.
 *
 * Order is pinned by `types.test.ts:292` — keep the explicit
 * `["Other", other, next]` literal so consumers using
 * `RESERVED_LABELS[i]` indexing or `Set` membership see no behavior change.
 */
export const RESERVED_LABELS = ["Other", ROW_INTENT_META.other.label, ROW_INTENT_META.next.label] as const;
export type ReservedLabel = (typeof RESERVED_LABELS)[number];

export function createOptionSchema(maxLabelLength = MAX_LABEL_LENGTH) {
	return Type.Object({
		label: Type.String({
			maxLength: maxLabelLength,
			description: `MAX ${maxLabelLength} CHARACTERS — hard limit, requests over the limit are rejected. The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.`,
		}),
		description: Type.String({
			description:
				"Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.",
		}),
		preview: Type.Optional(
			Type.String({
			description:
				"Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.",
		}),
	),
	});
}

export const OptionSchema = createOptionSchema();

export interface QuestionSchemaLimits {
	minQuestions?: number;
	minOptions?: number;
	maxOptions?: number;
	preferredMaxOptions?: number;
	maxHeaderLength?: number;
	maxLabelLength?: number;
}

export function createQuestionSchema(limits: QuestionSchemaLimits = {}) {
	const minOptions = limits.minOptions ?? MIN_OPTIONS;
	const maxOptions = limits.maxOptions ?? MAX_OPTIONS;
	const preferredMaxOptions = limits.preferredMaxOptions ?? PREFERRED_MAX_OPTIONS;
	const maxHeaderLength = limits.maxHeaderLength ?? MAX_HEADER_LENGTH;

	return Type.Object({
	question: Type.String({
		description:
			'The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"',
	}),
	header: Type.String({
			maxLength: maxHeaderLength,
			description: `MAX ${maxHeaderLength} CHARACTERS — hard limit, requests over the limit are rejected. Very short chip/tag shown next to the question. Examples: "Auth method", "Library", "Approach".`,
	}),
		options: Type.Array(createOptionSchema(limits.maxLabelLength), {
			minItems: minOptions,
			maxItems: maxOptions,
			description:
				`The available choices for this question. Must have ${minOptions}-${maxOptions} options; use ${preferredMaxOptions} or fewer when that sufficiently covers the choices, and add more only when necessary. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). The 'Type something.' row is appended automatically — do NOT author it.`,
	}),
	multiSelect: Type.Optional(
		Type.Boolean({
			default: false,
			description:
				"Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.",
		}),
	),
	});
}

export const QuestionSchema = createQuestionSchema();

export function createQuestionsSchema(
	maxQuestions = MAX_QUESTIONS,
	limits: QuestionSchemaLimits = {},
) {
	const minQuestions = limits.minQuestions ?? MIN_QUESTIONS;
	return Type.Array(createQuestionSchema(limits), {
		minItems: minQuestions,
		maxItems: maxQuestions,
		description: `Questions to ask the user (${minQuestions}-${maxQuestions} questions)`,
	});
}

export const QuestionsSchema = createQuestionsSchema();

export function createQuestionParamsSchema(
	maxQuestions = MAX_QUESTIONS,
	limits: QuestionSchemaLimits = {},
) {
	return Type.Object({
		questions: createQuestionsSchema(maxQuestions, limits),
	});
}

export const QuestionParamsSchema = createQuestionParamsSchema();

export type OptionData = Static<typeof OptionSchema>;
export type QuestionData = Static<typeof QuestionSchema>;
export type QuestionParams = Static<typeof QuestionParamsSchema>;

/**
 * Answer-intent discriminated union. `kind` is the single discriminator —
 * pre-1.0.3 boolean flags have been removed (see `banned-flags.test.ts`).
 * Mirrors the row-side `WrappingSelectItem.kind` vocabulary where possible;
 * `multi` is the multi-select variant (no row-side analog).
 *
 * Variant semantics:
 * - `option`: user picked one of the author-defined options. `answer` is the option's label.
 * - `custom`: user typed free-text via the "Type something." row in a single-select question. `answer` is the typed text or null.
 * - `multi`: user committed multi-select choices. `selected` carries chosen option labels and, when entered, the custom text; `answer` is null.
 */
export interface QuestionAnswer {
	questionIndex: number;
	question: string;
	kind: "option" | "custom" | "multi";
	answer: string | null;
	selected?: string[];
	notes?: string;
	/**
	 * Markdown text from the matched option's `preview` field, populated only
	 * when the user lands on a single-select option carrying a `preview`.
	 * Used by `buildQuestionnaireResponse` to echo `selected preview: <preview>`
	 * into the LLM-facing envelope. Undefined for multi-select and custom-text
	 * (`kind: "custom"`) answers.
	 */
	preview?: string;
}

export type QuestionnaireError =
	| "no_ui"
	| "no_custom_ui"
	| "no_questions"
	| "too_few_questions"
	| "empty_options"
	| "too_many_options"
	| "too_many_questions"
	| "duplicate_question"
	| "header_too_long"
	| "option_label_too_long"
	| "duplicate_option_label"
	| "reserved_label"
	| "session_load_failed"
	| "stale_module_cache";

export interface QuestionnaireResult {
	answers: QuestionAnswer[];
	cancelled: boolean;
	/**
	 * Global note authored on the Submit tab: `n` opens the shared notes editor there,
	 * and the committed text lives at the `notesByTab[questions.length]` pseudo-index
	 * (a slot no question tab can occupy) until `doneFor` lifts it onto the result —
	 * attached on both submit and cancel, like per-question `answers[].notes`.
	 * Conditional-spread contract, mirroring `QuestionAnswer.notes`: the key appears
	 * only via conditional spread of a non-empty string — never assigned `undefined`,
	 * never kept for an empty/whitespace-only draft — so note-free results stay
	 * byte-identical (`!("globalNote" in result)` holds).
	 */
	globalNote?: string;
	error?: QuestionnaireError;
}

export function isQuestionnaireResult(value: unknown): value is QuestionnaireResult {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Array.isArray(v.answers) && typeof v.cancelled === "boolean";
}
