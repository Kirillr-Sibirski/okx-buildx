import assert from "node:assert/strict";
import test from "node:test";

import { recommendNextIntent } from "../src/lib/runbook.js";
import type { ApprovalRecord, ExecuteResult, PolicyDecision } from "../src/types.js";

function makeApproval(): ApprovalRecord {
  return {
    tokenSymbol: "USDC",
    tokenAddress: "0x1000000000000000000000000000000000000001",
    chainIndex: "196",
    spenderAddress: "0x2000000000000000000000000000000000000002",
    allowance: "unlimited",
    allowanceRaw: "",
    isUnlimited: true,
    riskLevel: "high",
    raw: {}
  };
}

test("runbook recommends report when preflight blocks cleanup", () => {
  const approval = makeApproval();
  const decisions: PolicyDecision[] = [
    {
      approval,
      action: "revoke",
      severity: "high",
      reason: "High-risk approval should be removed."
    }
  ];
  const preflight: ExecuteResult[] = [
    {
      approval,
      plannedAction: "revoke",
      scan: { action: "block" },
      command: ["onchainos", "wallet", "contract-call"]
    }
  ];

  assert.equal(recommendNextIntent(decisions, preflight), "report");
});

test("runbook recommends execute when cleanup is actionable and preflight is safe", () => {
  const approval = makeApproval();
  const decisions: PolicyDecision[] = [
    {
      approval,
      action: "replace_with_exact_approval",
      severity: "high",
      reason: "Unlimited approval should be reduced.",
      replacementAllowance: "1000"
    }
  ];
  const preflight: ExecuteResult[] = [
    {
      approval,
      plannedAction: "replace_with_exact_approval",
      scan: { action: "safe" },
      command: ["onchainos", "wallet", "contract-call"]
    }
  ];

  assert.equal(recommendNextIntent(decisions, preflight), "execute");
});
