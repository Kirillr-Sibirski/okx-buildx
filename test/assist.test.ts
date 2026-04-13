import assert from "node:assert/strict";
import test from "node:test";

import { buildAssistPrompt, interpretAssistRequest } from "../src/lib/assist.js";

test("assist defaults to status checks with strict policy", () => {
  const result = interpretAssistRequest("Check my wallet health on X Layer");

  assert.equal(result.intent, "status");
  assert.equal(result.policy, "strict");
  assert.equal(result.chain, "xlayer");
  assert.equal(result.requestedApply, false);
});

test("assist routes report requests to report intent", () => {
  const result = interpretAssistRequest("Generate a markdown report for my approvals");

  assert.equal(result.intent, "report");
});

test("assist recognizes trading language and cleanup intent", () => {
  const result = interpretAssistRequest("Clean up risky approvals but keep trading routers active");

  assert.equal(result.intent, "execute");
  assert.equal(result.policy, "trading");
});

test("assist detects explicit live-apply language but does not force apply mode by itself", () => {
  const result = interpretAssistRequest("Revoke it and fix it now");

  assert.equal(result.intent, "execute");
  assert.equal(result.requestedApply, true);
});

test("assist heuristic interpretation marks its source", () => {
  const result = interpretAssistRequest("show approvals");

  assert.equal(result.source, "heuristic");
});

test("assist prompt asks for strict json output", () => {
  const prompt = buildAssistPrompt("Check my wallet health", "strict");

  assert.match(prompt, /Return strict JSON only/);
  assert.match(prompt, /\"intent\": \"status \| inspect \| plan \| report \| execute\"/);
});
