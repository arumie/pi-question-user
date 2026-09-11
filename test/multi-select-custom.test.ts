import assert from "node:assert/strict";
import test from "node:test";
import { routeKey } from "../state/key-router.ts";
import { reduce } from "../state/state-reducer.ts";
import { runRpcQuestionnaire } from "../rpc-fallback.ts";
import type { QuestionnaireRuntime, QuestionnaireState } from "../state/state.ts";
import type { QuestionData } from "../tool/types.ts";
import type { WrappingSelectItem } from "../view/components/wrapping-select.ts";

const ENTER = "<KEY:tui.select.confirm>";
const keybindings = { matches: (data: string, name: string) => data === `<KEY:${name}>` };

const question: QuestionData = {
	question: "Pick all that apply",
	header: "Choices",
	multiSelect: true,
	options: [
		{ label: "A", description: "a" },
		{ label: "B", description: "b" },
		{ label: "C", description: "c" },
	],
};

const items: WrappingSelectItem[] = [
	...question.options.map((option) => ({ kind: "option" as const, label: option.label })),
	{ kind: "other", label: "Type something." },
	{ kind: "next", label: "Next" },
];

function makeState(over: Partial<QuestionnaireState> = {}): QuestionnaireState {
	return {
		currentTab: 0,
		optionIndex: 0,
		inputMode: false,
		notesVisible: false,
		answers: new Map(),
		multiSelectChecked: new Set(),
		customDraftsByTab: new Map(),
		notesByTab: new Map(),
		submitChoiceIndex: 0,
		notesDraft: "",
		collapsed: false,
		...over,
	};
}

function makeRuntime(over: Partial<QuestionnaireRuntime> = {}): QuestionnaireRuntime {
	return {
		keybindings,
		inputBuffer: "",
		canMoveInputUp: false,
		canMoveInputDown: false,
		questions: [question],
		isMulti: false,
		currentItem: items[0],
		items,
		collapseKey: "ctrl+]",
		...over,
	};
}

test("custom text in a multi-select row is committed alongside checked options", () => {
	const state = makeState({
		optionIndex: question.options.length,
		inputMode: true,
		multiSelectChecked: new Set([0]),
	});
	const runtime = makeRuntime({ currentItem: items[3], inputBuffer: "A custom choice" });
	const action = routeKey(ENTER, state, runtime);

	assert.deepEqual(action, {
		kind: "confirm",
		answer: {
			questionIndex: 0,
			question: question.question,
			kind: "custom",
			answer: "A custom choice",
		},
		autoAdvanceTab: undefined,
	});

	const result = reduce(state, action, { questions: [question], itemsByTab: [items] });
	assert.deepEqual(result.state.answers.get(0), {
		questionIndex: 0,
		question: question.question,
		kind: "multi",
		answer: null,
		selected: ["A", "A custom choice"],
	});
	assert.equal(result.state.multiSelectChecked.has(0), true);
	assert.equal(result.state.customDraftsByTab.get(0), "A custom choice");
});

test("committing from Next includes an existing custom draft", () => {
	const state = makeState({
		optionIndex: question.options.length + 1,
		customDraftsByTab: new Map([[0, "A custom choice"]]),
		multiSelectChecked: new Set([1]),
	});
	const runtime = makeRuntime({ currentItem: items[4] });
	const action = routeKey(ENTER, state, runtime);

	assert.deepEqual(action, {
		kind: "multi_confirm",
		selected: ["B", "A custom choice"],
		autoAdvanceTab: undefined,
	});

	const result = reduce(state, action, { questions: [question], itemsByTab: [items] });
	assert.deepEqual(result.state.answers.get(0)?.selected, ["B", "A custom choice"]);
});

test("toggling an authored option preserves a custom draft", () => {
	const state = makeState({
		optionIndex: 1,
		customDraftsByTab: new Map([[0, "A custom choice"]]),
		multiSelectChecked: new Set([0]),
	});
	const runtime = makeRuntime({ currentItem: items[1] });
	const action = routeKey(" ", state, runtime);
	assert.deepEqual(action, { kind: "toggle", index: 1 });

	const result = reduce(state, action, { questions: [question], itemsByTab: [items] });
	assert.deepEqual(result.state.answers.get(0)?.selected, ["A", "B", "A custom choice"]);
});

test("RPC multi-select custom input is represented as a selected value", async () => {
	const result = await runRpcQuestionnaire(
		{
			select: async () => undefined,
			input: async () => "A custom choice",
		},
		{ questions: [question] },
	);

	assert.deepEqual(result.answers[0], {
		questionIndex: 0,
		question: question.question,
		kind: "multi",
		answer: null,
		selected: ["A custom choice"],
	});
});
