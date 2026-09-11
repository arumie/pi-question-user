/**
 * Public event contract for @arumie/question-user.
 *
 * STABILITY POLICY — applies to every event in the `question-user:*` namespace.
 *
 *   1. Channel names are immutable. Once shipped, never rename.
 *   2. Payload changes are append-only. Listeners MUST tolerate unknown
 *      fields. New fields ship as optional (`?:`).
 *   3. Breaking changes (rename, retype, remove a field; change emission
 *      semantics) require a NEW channel, e.g. `question-user:prompt.v2`,
 *      with dual-emit during a deprecation window.
 *   4. No `version` field inside payloads. Version via channel name only.
 *   5. Payloads must be JSON-safe: primitives, arrays, plain objects.
 *      No Set/Map/Date/class instances — payloads must survive JSON
 *      serialization when listeners forward them across process or
 *      network boundaries.
 *
 * Naming: `question-user:<phase>`, lowercase, hyphen-separated.
 * Aligns with Pi's `"my-extension:status"` example.
 */

export const QUESTION_USER_PROMPT_EVENT = "question-user:prompt" as const;

export interface QuestionUserPromptEventPayload {
	questions: ReadonlyArray<QuestionUserPromptQuestion>;
}

/**
 * Emitted while the questionnaire is awaiting user input (TUI `ui.custom` and
 * RPC dialog walker). Cleared with `{ active: false }` in `finally` so listeners
 * can distinguish blocked-on-human from working.
 */
export const QUESTION_USER_BLOCKED_EVENT = "question-user:blocked" as const;

export interface QuestionUserBlockedEventPayload {
	/** True while input is awaited; false when the wait ends (answer, cancel, or error). */
	active: boolean;
}

export interface QuestionUserPromptQuestion {
	/**
	 * The full question text as the agent authored it, with line terminators
	 * normalized at tool entry (`\r\n` → `\n`, lone `\r` removed — #192). The
	 * same normalization applies to `header` and every option field below.
	 */
	question: string;
	/** The short chip/tag shown next to the question. */
	header: string;
	/** True iff the user may pick multiple options. Normalized from optional. */
	multiSelect: boolean;
	options: ReadonlyArray<QuestionUserPromptOption>;
}

export interface QuestionUserPromptOption {
	label: string;
	description: string;
	/** True iff the option carries rich preview content (content not shipped). */
	hasPreview: boolean;
}
