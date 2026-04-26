import test from "node:test";
import assert from "node:assert/strict";

import { extractJsonFromModelText } from "../lib/deepseek-service.js";

test("extractJsonFromModelText parses fenced JSON", () => {
  const result = extractJsonFromModelText('```json\n{"ok":true,"score":82}\n```');
  assert.deepEqual(result, { ok: true, score: 82 });
});

test("extractJsonFromModelText parses JSON surrounded by prose", () => {
  const result = extractJsonFromModelText(
    'Here is the optimized result:\n{"resolvedKeyword":"resident evil wiki","recommendations":["Tighten headings"]}\nThanks.'
  );

  assert.equal(result.resolvedKeyword, "resident evil wiki");
  assert.deepEqual(result.recommendations, ["Tighten headings"]);
});
