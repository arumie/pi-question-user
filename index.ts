/**
 * question-user — English-only Pi extension. Registers the
 * `question-user` tool: a structured option selector with an automatically
 * appended `Type something.` custom-answer row.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerQuestionUserConfigCommand } from "./config-command.js";
import { registerQuestionUserTool } from "./question-user.js";
import { registerQuestionUserReconciler } from "./reconcile.js";

export {
	QUESTION_USER_BLOCKED_EVENT,
	QUESTION_USER_PROMPT_EVENT,
	type QuestionUserBlockedEventPayload,
	type QuestionUserPromptEventPayload,
	type QuestionUserPromptOption,
	type QuestionUserPromptQuestion,
} from "./events.js";

export default function (pi: ExtensionAPI) {
	registerQuestionUserTool(pi);
	registerQuestionUserConfigCommand(pi);
	registerQuestionUserReconciler(pi);
}
