import { buildWalletExplorerUrl } from "./explorer.js";

import type { ApprovalRecord, InspectionSummary, PolicyDecision } from "../types.js";

function displayAllowance(approval: ApprovalRecord): string {
  return approval.isUnlimited ? "unlimited" : approval.allowance;
}

function summarizeHealth(decisions: PolicyDecision[]): {
  grade: "clean" | "attention" | "critical";
  headline: string;
  nextAction: string;
} {
  if (!decisions.length) {
    return {
      grade: "clean",
      headline: "No active approvals were found.",
      nextAction: "No on-chain cleanup is needed. Export a report artifact if you want an audit trail."
    };
  }

  const revoke = decisions.find((decision) => decision.action === "revoke");
  if (revoke) {
    return {
      grade: "critical",
      headline: `${revoke.approval.tokenSymbol || revoke.approval.tokenAddress} has a revoke recommendation.`,
      nextAction: "Run execute --apply to remove the flagged approval through Agentic Wallet."
    };
  }

  const replace = decisions.find((decision) => decision.action === "replace_with_exact_approval");
  if (replace) {
    return {
      grade: "attention",
      headline: `${replace.approval.tokenSymbol || replace.approval.tokenAddress} should be reduced to an exact approval.`,
      nextAction: replace.replacementAllowance
        ? "Run execute --apply to replace the unlimited approval with the configured exact allowance."
        : "Run execute --apply to clear the oversized approval, then re-grant the exact amount your workflow needs."
    };
  }

  const review = decisions.find((decision) => decision.action === "review");
  if (review) {
    return {
      grade: "attention",
      headline: `${review.approval.tokenSymbol || review.approval.tokenAddress} needs human review.`,
      nextAction: "Inspect the report and confirm whether the approval should remain active."
    };
  }

  return {
    grade: "clean",
    headline: "All detected approvals are compatible with the current policy.",
    nextAction: "No cleanup is needed right now."
  };
}

export function summarizeApprovals(approvals: ApprovalRecord[]): InspectionSummary {
  let unlimitedApprovals = 0;
  let highRiskApprovals = 0;
  let mediumRiskApprovals = 0;
  let lowRiskApprovals = 0;

  for (const approval of approvals) {
    if (approval.isUnlimited) {
      unlimitedApprovals += 1;
    }

    const risk = approval.riskLevel.toLowerCase();
    if (risk.includes("high")) {
      highRiskApprovals += 1;
    } else if (risk.includes("medium")) {
      mediumRiskApprovals += 1;
    } else {
      lowRiskApprovals += 1;
    }
  }

  return {
    totalApprovals: approvals.length,
    unlimitedApprovals,
    highRiskApprovals,
    mediumRiskApprovals,
    lowRiskApprovals
  };
}

export function formatInspection(approvals: ApprovalRecord[]): string {
  const summary = summarizeApprovals(approvals);
  const lines = [
    "OKX Approval Firewall Inspection",
    `Total approvals: ${summary.totalApprovals}`,
    `Unlimited approvals: ${summary.unlimitedApprovals}`,
    `High risk approvals: ${summary.highRiskApprovals}`,
    `Medium risk approvals: ${summary.mediumRiskApprovals}`,
    `Low risk approvals: ${summary.lowRiskApprovals}`,
    ""
  ];

  if (!approvals.length) {
    lines.push("No approvals found for the selected wallet or chain.", "");
    return lines.join("\n");
  }

  for (const approval of approvals) {
    lines.push(
      `${approval.tokenSymbol || "UNKNOWN"} on chain ${approval.chainIndex}`,
      `  Token: ${approval.tokenAddress}`,
      `  Spender: ${approval.spenderAddress}`,
      `  Allowance: ${displayAllowance(approval)}`,
      `  Risk: ${approval.riskLevel || "unknown"}`,
      ""
    );
  }

  return lines.join("\n");
}

export function formatPlan(decisions: PolicyDecision[]): string {
  const lines = ["OKX Approval Firewall Plan", ""];

  if (!decisions.length) {
    lines.push("No policy actions are needed for the selected wallet or chain.", "");
    return lines.join("\n");
  }

  for (const decision of decisions) {
    lines.push(
      `${decision.action.toUpperCase()} [${decision.severity}]`,
      `  Token: ${decision.approval.tokenSymbol || decision.approval.tokenAddress}`,
      `  Spender: ${decision.approval.spenderAddress}`,
      `  Allowance: ${displayAllowance(decision.approval)}`,
      `  Why: ${decision.reason}`
    );

    if (decision.policyLabel) {
      lines.push(`  Policy label: ${decision.policyLabel}`);
    }
    if (decision.replacementAllowance) {
      lines.push(`  Replacement allowance: ${decision.replacementAllowance}`);
    }
    if (decision.notes?.length) {
      lines.push(`  Notes: ${decision.notes.join(" | ")}`);
    }

    lines.push(
      ""
    );
  }

  return lines.join("\n");
}

export function formatMarkdownReport(
  approvals: ApprovalRecord[],
  decisions: PolicyDecision[],
  policy: string
): string {
  const summary = summarizeApprovals(approvals);
  const health = summarizeHealth(decisions);
  const lines = [
    "# OKX Approval Firewall Report",
    "",
    `Policy preset: \`${policy}\``,
    "",
    "## Executive Summary",
    `- Risk grade: \`${health.grade}\``,
    `- Headline: ${health.headline}`,
    `- Next action: ${health.nextAction}`,
    "",
    "## Summary",
    `- Total approvals: ${summary.totalApprovals}`,
    `- Unlimited approvals: ${summary.unlimitedApprovals}`,
    `- High risk approvals: ${summary.highRiskApprovals}`,
    `- Medium risk approvals: ${summary.mediumRiskApprovals}`,
    `- Low risk approvals: ${summary.lowRiskApprovals}`,
    "",
    "## Recommended Actions"
  ];

  if (!decisions.length) {
    lines.push("- No approval actions are needed.");
  }

  for (const decision of decisions) {
    lines.push(
      `- **${decision.action}** for \`${decision.approval.tokenSymbol || decision.approval.tokenAddress}\` -> \`${decision.approval.spenderAddress}\`: ${decision.reason}`
    );
    if (decision.policyLabel) {
      lines.push(`  - Policy label: \`${decision.policyLabel}\``);
    }
    if (decision.replacementAllowance) {
      lines.push(`  - Replacement allowance: \`${decision.replacementAllowance}\``);
    }
    if (decision.notes?.length) {
      lines.push(`  - Notes: ${decision.notes.join(" | ")}`);
    }
  }

  lines.push("", "## Raw Approvals");

  if (!approvals.length) {
    lines.push("- No approvals were found.");
    return lines.join("\n");
  }

  for (const approval of approvals) {
    lines.push(
      `- \`${approval.tokenSymbol || "UNKNOWN"}\` on chain \`${approval.chainIndex}\`: spender \`${approval.spenderAddress}\`, allowance \`${displayAllowance(approval)}\`, risk \`${approval.riskLevel || "unknown"}\``
    );
  }

  return lines.join("\n");
}

export function formatStatus(params: {
  address: string;
  chain?: string;
  policy: string;
  approvals: ApprovalRecord[];
  decisions: PolicyDecision[];
}): string {
  const summary = summarizeApprovals(params.approvals);
  const health = summarizeHealth(params.decisions);
  const topDecision = params.decisions.find((decision) => decision.action !== "keep");
  const lines = [
    "OKX Approval Firewall Status",
    `Wallet: ${params.address}`,
    `Chain: ${params.chain ?? "all"}`,
    `Policy: ${params.policy}`,
    `Risk grade: ${health.grade}`,
    `Headline: ${health.headline}`,
    `Approvals: ${summary.totalApprovals} total | ${summary.unlimitedApprovals} unlimited | ${summary.highRiskApprovals} high risk`,
    `Next action: ${health.nextAction}`,
    ""
  ];

  const walletExplorerUrl = buildWalletExplorerUrl(params.address, params.chain);
  if (walletExplorerUrl) {
    lines.push(`Wallet explorer: ${walletExplorerUrl}`, "");
  }

  if (topDecision) {
    lines.push(
      "Top finding",
      `  Action: ${topDecision.action}`,
      `  Token: ${topDecision.approval.tokenSymbol || topDecision.approval.tokenAddress}`,
      `  Spender: ${topDecision.approval.spenderAddress}`,
      `  Why: ${topDecision.reason}`,
      ""
    );
  } else {
    lines.push("Top finding", "  Nothing needs action right now.", "");
  }

  return lines.join("\n");
}
