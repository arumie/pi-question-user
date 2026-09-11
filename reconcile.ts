/**
 * reconcile — mid-session lifecycle reconciliation for question-user.
 *
 * Strips or re-adds the tool to the active set so it is invisible to the LLM
 * in non-interactive runs (no UI) and present in interactive ones. Mirrors the
 * advisor's reconcileAdvisorTool / registerAdvisorBeforeAgentStart pattern
 * (packages/rpiv-advisor/advisor/handlers.ts), simplified: question-user's
 * only gating signal is ctx.hasUI (no model or executor blocklist), so it
 * reads the flag directly and omits the notify.
 *
 * RPC hosts (ctx.mode === "rpc": VSCode pendant, Zed, Paseo) are deliberately
 * NOT stripped: since PR #100 the tool renders there via the select/input
 * dialog walker (rpc-fallback.ts), so hasUI is the honest signal again. The
 * brief period where RPC was stripped (872ef1c) predates that fallback.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { QUESTION_USER_TOOL_NAME } from "./question-user.js";

/**
 * Strip-or-restore `question-user` to match `ctx.hasUI`. Reads the active
 * tool list itself. Idempotent: when the tool is already in the right state it
 * leaves the active set (and sibling tools) untouched.
 */
export function reconcileQuestionUserTool(pi: ExtensionAPI, ctx: ExtensionContext): void {
	const active = pi.getActiveTools();
	const hasTool = active.includes(QUESTION_USER_TOOL_NAME);
	// !hasUI → strip so the tool never reaches the LLM's tool list in
	// non-interactive runs; hasUI → restore. The in-handler guards in
	// question-user.ts (!hasUI, and the custom()-undefined → dialog-walker /
	// no_custom_ui backstop) remain as one-turn backstops if a future Pi change
	// reorders the tool-list snapshot ahead of before_agent_start, or a host
	// reports hasUI without any usable rendering primitive.
	if (!ctx.hasUI && hasTool) {
		pi.setActiveTools(active.filter((n) => n !== QUESTION_USER_TOOL_NAME));
	} else if (ctx.hasUI && !hasTool) {
		pi.setActiveTools([...active, QUESTION_USER_TOOL_NAME]);
	}
}

/**
 * Attach the reconciler to `before_agent_start` so the active set is fixed up
 * before each turn's tool-list snapshot is read. Safe to call once at load.
 */
export function registerQuestionUserReconciler(pi: ExtensionAPI): void {
	pi.on("before_agent_start", (_event, ctx) => reconcileQuestionUserTool(pi, ctx));
}
