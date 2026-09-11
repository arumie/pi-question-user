import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
  name?: string;
  files?: string[];
  pi?: { extensions?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const entrypoint = await readFile(new URL("../question-user.ts", import.meta.url), "utf8");

test("package manifest ships and registers the question-user extension", () => {
  assert.equal(manifest.name, "@arumie/question-user");
  assert.deepEqual(manifest.pi?.extensions, ["./index.ts"]);
  assert.ok(manifest.files?.includes("question-user.ts"));
  assert.ok(manifest.files?.includes("events.ts"));
  assert.ok(manifest.files?.includes("state/"));
  assert.ok(manifest.files?.includes("tool/"));
  assert.ok(manifest.files?.includes("view/"));

  const allDependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  assert.ok(!Object.keys(allDependencies).some((name) => name.startsWith("@juicesharp/")));
});

test("the extension registers the renamed tool", () => {
  assert.match(entrypoint, /QUESTION_USER_TOOL_NAME = "question-user"/);
  assert.match(entrypoint, /name: QUESTION_USER_TOOL_NAME/);
});
