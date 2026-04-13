import { summarizeApprovals } from "./format.js";
import { createChatCompletion } from "./llm.js";

import type { ApprovalRecord, PolicyDecision, PolicyPreset } from "../types.js";

export interface BriefContext {
  address: string;
  chain?: string;
  policy: PolicyPreset;
  approvals: ApprovalRecord[];
  decisions: PolicyDecision[];
}

export function buildBriefPrompt(context: BriefContext): string {
  const summary = summarizeApprovals(context.approvals);
  const actions = context.decisions
    .filter((decision) => decision.action !== "keep")
    .slice(0, 5)
    .map((decision) => ({
      action: decision.action,
      severity: decision.severity,
      token: decision.approval.tokenSymbol || decision.approval.tokenAddress,
      spender: decision.approval.spenderAddress,
      reason: decision.reason,
      replacementAllowance: decision.replacementAllowance ?? null
    }));

  return [
    "Create a concise operator briefing for an approval firewall run.",
    "Focus on risk, next action, and execution safety.",
    "",
    `Wallet: ${context.address}`,
    `Chain: ${context.chain ?? "default"}`,
    `Policy: ${context.policy}`,
    "",
    "Approval summary:",
    JSON.stringify(summary, null, 2),
    "",
    "Top policy actions:",
    JSON.stringify(actions, null, 2),
    "",
    "Return markdown with these sections:",
    "1. Operator Summary",
    "2. Critical Findings",
    "3. Recommended Next Step",
    "4. Safety Notes"
  ].join("\n");
}

export async function generateOperatorBrief(params: BriefContext & {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<string> {
  return createChatCompletion({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    model: params.model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a security-focused approval firewall copilot. Be concise, practical, and operator-friendly."
      },
      {
        role: "user",
        content: buildBriefPrompt(params)
      }
    ]
  });
}
