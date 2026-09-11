import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import { resolveMaxQuestions } from "../config.ts";
import {
	MAX_HEADER_LENGTH,
	MAX_LABEL_LENGTH,
	MAX_QUESTIONS,
	createQuestionParamsSchema,
} from "../tool/types.ts";
import { validateQuestionnaire } from "../tool/validate-questionnaire.ts";

function makeQuestion(index: number) {
	return {
		question: `Question ${index}?`,
		header: `Q${index}`,
		options: [
			{ label: `A${index}`, description: "First option" },
			{ label: `B${index}`, description: "Second option" },
		],
	};
}

function makeParams(count: number) {
	return { questions: Array.from({ length: count }, (_, index) => makeQuestion(index)) };
}

test("configured maxQuestions expands the parameter schema and runtime guard", () => {
	const params = makeParams(6);
	const schema = createQuestionParamsSchema(6);

	assert.equal(Value.Check(schema, params), true);
	assert.equal(Value.Check(schema, makeParams(7)), false);
	assert.equal(validateQuestionnaire(params as never, 6).ok, true);
	assert.equal(validateQuestionnaire(params as never).ok, false);
});

test("maxQuestions accepts only positive safe integers and otherwise defaults to four", () => {
	assert.equal(resolveMaxQuestions(undefined), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions("8"), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(0), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(-1), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(1.5), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(8), 8);
	assert.equal(resolveMaxQuestions(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
});

test("header and option-label length limits are 50 and 200 characters", () => {
	const valid = makeParams(1);
	const schema = createQuestionParamsSchema();

	assert.equal(MAX_HEADER_LENGTH, 50);
	assert.equal(MAX_LABEL_LENGTH, 200);
	assert.equal(Value.Check(schema, valid), true);

	const longHeader = makeParams(1);
	longHeader.questions[0]!.header = "h".repeat(51);
	assert.equal(Value.Check(schema, longHeader), false);

	const longLabel = makeParams(1);
	longLabel.questions[0]!.options[0]!.label = "l".repeat(201);
	assert.equal(Value.Check(schema, longLabel), false);
});
