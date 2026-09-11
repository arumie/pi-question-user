import {
	MAX_HEADER_LENGTH,
	MAX_LABEL_LENGTH,
	MAX_OPTIONS,
	MAX_QUESTIONS,
	MIN_OPTIONS,
	MIN_QUESTIONS,
	type QuestionnaireError,
	type QuestionParams,
	RESERVED_LABELS,
} from "./types.js";

export const ERROR_NO_QUESTIONS = "Error: At least one question is required";
export const ERROR_TOO_FEW_QUESTIONS = `Error: At least ${MIN_QUESTIONS} questions are required per invocation`;
export const ERROR_TOO_MANY_QUESTIONS = `Error: At most ${MAX_QUESTIONS} questions are allowed per invocation`;
export const ERROR_DUPLICATE_QUESTION = "Error: Question text must be unique within an invocation";
export const ERROR_HEADER_TOO_LONG = `Error: Question headers must be at most ${MAX_HEADER_LENGTH} characters`;
export const ERROR_OPTION_LABEL_TOO_LONG = `Error: Option labels must be at most ${MAX_LABEL_LENGTH} characters`;
export const ERROR_TOO_FEW_OPTIONS = `Error: Each question requires at least ${MIN_OPTIONS} options`;
export const ERROR_TOO_MANY_OPTIONS = `Error: Each question allows at most ${MAX_OPTIONS} options`;
export const ERROR_RESERVED_LABEL = `Error: Option label is reserved (${RESERVED_LABELS.join(", ")})`;
export const ERROR_DUPLICATE_OPTION_LABEL = "Error: Option labels must be unique within a question";

const RESERVED_LABEL_SET: ReadonlySet<string> = new Set(RESERVED_LABELS);

export type ValidationResult = { ok: true } | { ok: false; error: QuestionnaireError; message: string };

/**
 * Pure runtime validator for `QuestionParams`. Covers every guard except
 * `no_ui` (which depends on `ctx.hasUI` and stays inline at the call site).
 * `reserved_label` MUST short-circuit before `duplicate_option_label`.
 */
export function validateQuestionnaire(
	typed: QuestionParams,
	maxQuestions = MAX_QUESTIONS,
	maxOptions = MAX_OPTIONS,
	minQuestions = MIN_QUESTIONS,
	minOptions = MIN_OPTIONS,
	maxHeaderLength = MAX_HEADER_LENGTH,
	maxLabelLength = MAX_LABEL_LENGTH,
): ValidationResult {
	if (typed.questions.length < minQuestions) {
		if (typed.questions.length === 0) {
			return { ok: false, error: "no_questions", message: ERROR_NO_QUESTIONS };
		}
		return {
			ok: false,
			error: "too_few_questions",
			message: `Error: At least ${minQuestions} questions are required per invocation`,
		};
	}
	if (typed.questions.length > maxQuestions) {
		return {
			ok: false,
			error: "too_many_questions",
			message: `Error: At most ${maxQuestions} questions are allowed per invocation`,
		};
	}

	const seenQuestions = new Set<string>();
	for (const q of typed.questions) {
		if (q.header.length > maxHeaderLength) {
			return {
				ok: false,
				error: "header_too_long",
				message: `Error: Question headers must be at most ${maxHeaderLength} characters`,
			};
		}
		if (seenQuestions.has(q.question)) {
			return { ok: false, error: "duplicate_question", message: ERROR_DUPLICATE_QUESTION };
		}
		seenQuestions.add(q.question);
	}

	for (const q of typed.questions) {
		if (q.options.length < minOptions) {
			return {
				ok: false,
				error: "empty_options",
				message: `Error: Each question requires at least ${minOptions} options`,
			};
		}
		if (q.options.length > maxOptions) {
			return {
				ok: false,
				error: "too_many_options",
				message: `Error: Each question allows at most ${maxOptions} options`,
			};
		}
		const seenLabels = new Set<string>();
		for (const o of q.options) {
			if (o.label.length > maxLabelLength) {
				return {
					ok: false,
					error: "option_label_too_long",
					message: `Error: Option labels must be at most ${maxLabelLength} characters`,
				};
			}
			if (RESERVED_LABEL_SET.has(o.label)) {
				return { ok: false, error: "reserved_label", message: ERROR_RESERVED_LABEL };
			}
			if (seenLabels.has(o.label)) {
				return {
					ok: false,
					error: "duplicate_option_label",
					message: ERROR_DUPLICATE_OPTION_LABEL,
				};
			}
			seenLabels.add(o.label);
		}
	}

	return { ok: true };
}
