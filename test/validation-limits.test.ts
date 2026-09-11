import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import {
	resolveMaxHeaderLength,
	resolveMaxLabelLength,
	resolveMaxOptions,
	resolveMaxQuestions,
	resolveMinOptions,
	resolveMinQuestions,
	resolvePreferredMaxOptions,
} from "../config.ts";
import {
	MAX_HEADER_LENGTH,
	MAX_LABEL_LENGTH,
	MAX_OPTIONS,
	MAX_QUESTIONS,
	MIN_OPTIONS,
	MIN_QUESTIONS,
	PREFERRED_MAX_OPTIONS,
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

test("all configurable limits fall back safely and preserve their relationships", () => {
	assert.equal(resolveMinQuestions(undefined), MIN_QUESTIONS);
	assert.equal(resolveMinQuestions(3), 3);
	assert.equal(resolveMaxQuestions(undefined), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions("8"), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(0), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(-1), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(1.5), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(2, 3), MAX_QUESTIONS);
	assert.equal(resolveMaxQuestions(8, 3), 8);
	assert.equal(resolveMaxQuestions(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);

	assert.equal(resolveMinOptions(undefined), MIN_OPTIONS);
	assert.equal(resolveMinOptions(1), 1);
	assert.equal(resolveMinOptions(0), MIN_OPTIONS);
	assert.equal(resolveMaxOptions(undefined), MAX_OPTIONS);
	assert.equal(resolveMaxOptions(1, 3), MAX_OPTIONS);
	assert.equal(resolveMaxOptions(8, 3), 8);
	assert.equal(resolvePreferredMaxOptions(undefined), PREFERRED_MAX_OPTIONS);
	assert.equal(resolvePreferredMaxOptions(2, 3, 8), PREFERRED_MAX_OPTIONS);
	assert.equal(resolvePreferredMaxOptions(6, 3, 8), 6);
	assert.equal(resolvePreferredMaxOptions(undefined, 8, 12), 8);

	assert.equal(resolveMaxHeaderLength(undefined), MAX_HEADER_LENGTH);
	assert.equal(resolveMaxHeaderLength(10), 10);
	assert.equal(resolveMaxLabelLength(undefined), MAX_LABEL_LENGTH);
	assert.equal(resolveMaxLabelLength(10), 10);
});

test("option count is limited to 2 through 12 options", () => {
	const valid = makeParams(1);
	valid.questions[0]!.options = Array.from({ length: MAX_OPTIONS }, (_, index) => ({
		label: `Option ${index}`,
		description: `Option ${index} description`,
	}));
	const schema = createQuestionParamsSchema();

	assert.equal(MAX_OPTIONS, 12);
	assert.equal(Value.Check(schema, valid), true);

	valid.questions[0]!.options.push({ label: "Option 12", description: "Too many options" });
	assert.equal(Value.Check(schema, valid), false);
});

test("configured min/max limits are applied to the parameter schema", () => {
	const limits = {
		minQuestions: 2,
		minOptions: 3,
		maxOptions: 6,
		preferredMaxOptions: 4,
		maxHeaderLength: 10,
		maxLabelLength: 8,
	};
	const params = makeParams(2);
	for (const question of params.questions) {
		question.options.push({ label: "C", description: "Third option" });
	}
	const schema = createQuestionParamsSchema(6, limits);

	assert.equal(Value.Check(schema, params), true);
	assert.equal(Value.Check(schema, makeParams(1)), false);
	assert.equal(Value.Check(schema, makeParams(7)), false);
	assert.equal(validateQuestionnaire(params as never, 6, 6, 2, 3).ok, true);
	assert.equal(validateQuestionnaire(makeParams(1) as never, 6, 6, 2, 3).error, "too_few_questions");

	const tooFewOptions = makeParams(2);
	assert.equal(validateQuestionnaire(tooFewOptions as never, 6, 6, 2, 3).error, "empty_options");

	const tooManyOptions = makeParams(2);
	for (const question of tooManyOptions.questions) {
		question.options.push(
			{ label: "C", description: "Third option" },
			{ label: "D", description: "Fourth option" },
			{ label: "E", description: "Fifth option" },
			{ label: "F", description: "Sixth option" },
		);
	}
	assert.equal(Value.Check(schema, tooManyOptions), true);
	tooManyOptions.questions[0]!.options.push({ label: "G", description: "Seventh option" });
	assert.equal(Value.Check(schema, tooManyOptions), false);
	assert.equal(validateQuestionnaire(tooManyOptions as never, 6, 6, 2, 3).error, "too_many_options");

	const longHeader = makeParams(2);
	for (const question of longHeader.questions) question.options.push({ label: "C", description: "Third option" });
	longHeader.questions[0]!.header = "h".repeat(11);
	assert.equal(Value.Check(schema, longHeader), false);
	assert.equal(validateQuestionnaire(longHeader as never, 6, 6, 2, 3, 10, 8).error, "header_too_long");

	const longLabel = makeParams(2);
	for (const question of longLabel.questions) question.options.push({ label: "C", description: "Third option" });
	longLabel.questions[0]!.options[0]!.label = "l".repeat(9);
	assert.equal(Value.Check(schema, longLabel), false);
	assert.equal(validateQuestionnaire(longLabel as never, 6, 6, 2, 3, 10, 8).error, "option_label_too_long");
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
