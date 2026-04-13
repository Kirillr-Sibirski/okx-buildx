import { buildWalletExplorerUrl } from "./explorer.js";

import type { ExecuteResult, PolicyDecision, PolicyPreset } from "../types.js";

type CommandIntent = "doctor" | "review" | "status" | "inspect" | "plan" | "report" | "execute";

export function recommendNextIntent(
  decisions: PolicyDecision[],
  preflightResults?: ExecuteResult[]
): CommandIntent {
  if (
    preflightResults?.some(
      (result) => result.scan.action === "block" || result.replacementScan?.action === "block"
    )
  ) {
    return "report";
  }

  if (decisions.some((decision) => decision.action === "revoke" || decision.action === "replace_with_exact_approval")) {
    return "execute";
  }

  if (decisions.some((decision) => decision.action === "review")) {
    return "report";
  }

  return "status";
}

export function buildRecommendedCommand(params: {
  intent: CommandIntent;
  policy: PolicyPreset;
  address?: string;
  chain?: string;
  config?: string;
  apply?: boolean;
  output?: string;
}): string {
  const args = ["npm", "run", "dev", "--", params.intent];

  if (params.intent !== "inspect") {
    args.push("--policy", params.policy);
  }
  if (params.address) {
    args.push("--address", params.address);
  }
  if (params.chain) {
    args.push("--chain", params.chain);
  }
  if (params.config) {
    args.push("--config", params.config);
  }
  if (params.intent === "execute" && params.apply) {
    args.push("--apply");
  }
  if (params.intent === "report" && params.output) {
    args.push("--output", params.output);
  }

  return args.join(" ");
}

export function buildWalletExplorerLine(address: string, chain?: string): string | undefined {
  const url = buildWalletExplorerUrl(address, chain);
  if (!url) {
    return undefined;
  }
  return `Wallet explorer: ${url}`;
}
