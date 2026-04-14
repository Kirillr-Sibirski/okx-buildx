import { buildWalletExplorerUrl } from "./explorer.js";

import type {
  ApprovalRecord,
  ExecuteResult,
  ExecutionVerification,
  InspectionSummary,
  PolicyDecision
} from "../types.js";

function title(text: string): string {
  return text.toUpperCase();
}

function section(text: string): string[] {
  return [title(text), "-".repeat(text.length)];
}

function labeled(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function wrapText(text: string, width: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function formatAsciiCard(titleText: string, rows: Array<[string, string]>): string[] {
  const labelWidth = 13;
  const valueWidth = 58;
  const innerWidth = labelWidth + 3 + valueWidth;
  const top = `+${"-".repeat(innerWidth + 2)}+`;
  const titleLine = `| ${titleText.padEnd(innerWidth)} |`;
  const divider = `+${"-".repeat(labelWidth + 2)}+${"-".repeat(valueWidth + 2)}+`;
  const lines = [top, titleLine, divider];

  for (const [label, rawValue] of rows) {
    const wrapped = wrapText(rawValue, valueWidth);
    wrapped.forEach((line, index) => {
      lines.push(
        `| ${(index === 0 ? label : "").padEnd(labelWidth)} | ${line.padEnd(valueWidth)} |`
      );
    });
  }

  lines.push(top);
  return lines;
}

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

export function summarizeActionCounts(decisions: PolicyDecision[]): {
  actionableCount: number;
  cleanupCount: number;
  reviewCount: number;
} {
  let cleanupCount = 0;
  let reviewCount = 0;

  for (const decision of decisions) {
    if (decision.action === "revoke" || decision.action === "replace_with_exact_approval") {
      cleanupCount += 1;
      continue;
    }

    if (decision.action === "review") {
      reviewCount += 1;
    }
  }

  return {
    actionableCount: cleanupCount + reviewCount,
    cleanupCount,
    reviewCount
  };
}

function formatDelta(before: number, after: number): string {
  const delta = after - before;
  if (delta === 0) {
    return `${before} -> ${after}`;
  }

  return `${before} -> ${after} (${delta > 0 ? "+" : ""}${delta})`;
}

function summarizePreflight(results: ExecuteResult[]): {
  safeCount: number;
  blockedCount: number;
  replacementBlockedCount: number;
} {
  let safeCount = 0;
  let blockedCount = 0;
  let replacementBlockedCount = 0;

  for (const result of results) {
    if (result.scan.action === "block") {
      blockedCount += 1;
    } else {
      safeCount += 1;
    }

    if (result.replacementScan?.action === "block") {
      replacementBlockedCount += 1;
    }
  }

  return {
    safeCount,
    blockedCount,
    replacementBlockedCount
  };
}

export function formatInspection(
  approvals: ApprovalRecord[],
  decisions?: PolicyDecision[],
  configPath?: string
): string {
  const summary = summarizeApprovals(approvals);
  const decisionMap = new Map<string, PolicyDecision>();
  for (const decision of decisions ?? []) {
    decisionMap.set(
      `${decision.approval.chainIndex}:${decision.approval.tokenAddress.toLowerCase()}:${decision.approval.spenderAddress.toLowerCase()}`,
      decision
    );
  }
  const lines = [
    title("onchainos-approval-firewall inspection"),
    "",
    ...section("Summary"),
    labeled("Total approvals", String(summary.totalApprovals)),
    labeled("Unlimited", String(summary.unlimitedApprovals)),
    labeled("High risk", String(summary.highRiskApprovals)),
    labeled("Medium risk", String(summary.mediumRiskApprovals)),
    labeled("Low risk", String(summary.lowRiskApprovals)),
    ""
  ];
  if (configPath) {
    lines.push(`Policy config: ${configPath}`, "");
  }

  if (!approvals.length) {
    lines.push("No approvals found for the selected wallet or chain.", "");
    return lines.join("\n");
  }

  for (const approval of approvals) {
    const key = `${approval.chainIndex}:${approval.tokenAddress.toLowerCase()}:${approval.spenderAddress.toLowerCase()}`;
    const decision = decisionMap.get(key);
    lines.push(
      ...section(`${approval.tokenSymbol || "UNKNOWN"} on chain ${approval.chainIndex}`),
      labeled("Token", approval.tokenAddress),
      labeled("Spender", approval.spenderAddress),
      labeled("Allowance", displayAllowance(approval)),
      labeled("Provider risk", approval.riskLevel || "unknown"),
      ...(decision
        ? [
            labeled("Policy action", decision.action),
            labeled("Policy severity", decision.severity),
            labeled("Policy reason", decision.reason),
            ...(decision.policyLabel ? [labeled("Policy label", decision.policyLabel)] : []),
            ...(decision.replacementAllowance ? [labeled("Replacement", decision.replacementAllowance)] : []),
            ...(decision.notes?.length ? [labeled("Policy notes", decision.notes.join(" | "))] : [])
          ]
        : []),
      ""
    );
  }

  return lines.join("\n");
}

export function formatPlan(decisions: PolicyDecision[]): string {
  const lines = [title("onchainos-approval-firewall plan"), ""];

  if (!decisions.length) {
    lines.push("No policy actions are needed for the selected wallet or chain.", "");
    return lines.join("\n");
  }

  for (const decision of decisions) {
    lines.push(
      ...section(`${decision.action.toUpperCase()} [${decision.severity}]`),
      labeled("Token", decision.approval.tokenSymbol || decision.approval.tokenAddress),
      labeled("Spender", decision.approval.spenderAddress),
      labeled("Allowance", displayAllowance(decision.approval)),
      labeled("Why", decision.reason)
    );

    if (decision.policyLabel) {
      lines.push(labeled("Policy label", decision.policyLabel));
    }
    if (decision.replacementAllowance) {
      lines.push(labeled("Replacement", decision.replacementAllowance));
    }
    if (decision.notes?.length) {
      lines.push(labeled("Notes", decision.notes.join(" | ")));
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
    "# onchainos-approval-firewall report",
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
    title("onchainos-approval-firewall status"),
    "",
    ...section("Summary"),
    labeled("Wallet", params.address),
    labeled("Chain", params.chain ?? "all"),
    labeled("Policy", params.policy),
    labeled("Risk grade", health.grade),
    labeled("Headline", health.headline),
    labeled("Approvals", `${summary.totalApprovals} total | ${summary.unlimitedApprovals} unlimited | ${summary.highRiskApprovals} high risk`),
    labeled("Next action", health.nextAction),
    ""
  ];

  const walletExplorerUrl = buildWalletExplorerUrl(params.address, params.chain);
  if (walletExplorerUrl) {
    lines.push(`Wallet explorer: ${walletExplorerUrl}`, "");
  }

  if (topDecision) {
    lines.push(
      ...section("Top finding"),
      labeled("Action", topDecision.action),
      labeled("Token", topDecision.approval.tokenSymbol || topDecision.approval.tokenAddress),
      labeled("Spender", topDecision.approval.spenderAddress),
      labeled("Why", topDecision.reason),
      ""
    );
  } else {
    lines.push(...section("Top finding"), "Nothing needs action right now.", "");
  }

  return lines.join("\n");
}

export function formatReview(params: {
  address: string;
  chain?: string;
  policy: string;
  configPath?: string;
  approvals: ApprovalRecord[];
  decisions: PolicyDecision[];
  preflight?: ExecuteResult[];
  recommendedCommand: string;
  brief?: string;
  briefError?: string;
}): string {
  const summary = summarizeApprovals(params.approvals);
  const health = summarizeHealth(params.decisions);
  const counts = summarizeActionCounts(params.decisions);
  const currentApprovals = params.decisions.slice(0, 5);
  const lines = [
    title("onchainos-approval-firewall review"),
    "",
    labeled("Wallet", params.address),
    labeled("Chain", params.chain ?? "all"),
    labeled("Policy", params.policy),
    labeled("Status", `${health.grade} | ${summary.totalApprovals} approvals | ${counts.actionableCount} actionable`),
    labeled("Headline", health.headline)
  ];

  const walletExplorerUrl = buildWalletExplorerUrl(params.address, params.chain);
  if (walletExplorerUrl) {
    lines.push(`Wallet explorer: ${walletExplorerUrl}`);
  }
  if (params.configPath) {
    lines.push(`Policy config: ${params.configPath}`);
  }

  lines.push("", ...section("Current approvals"));

  if (!currentApprovals.length) {
    lines.push("No approvals found.");
  } else {
    for (const decision of currentApprovals) {
      const rows: Array<[string, string]> = [
        ["Spender", decision.approval.spenderAddress],
        ["Allowance", displayAllowance(decision.approval)],
        ["Provider risk", decision.approval.riskLevel || "unknown"],
        ["Reason", decision.reason]
      ];
      if (decision.policyLabel) {
        rows.push(["Policy label", decision.policyLabel]);
      }
      if (decision.replacementAllowance) {
        rows.push(["Replacement", decision.replacementAllowance]);
      }
      lines.push(
        ...formatAsciiCard(
          `${decision.action.toUpperCase()} [${decision.severity}] ${decision.approval.tokenSymbol || decision.approval.tokenAddress}`,
          rows
        ),
        ""
      );
    }
  }

  if (params.preflight?.length) {
    const preflightSummary = summarizePreflight(params.preflight);
    lines.push(
      "",
      ...section("Preflight remediation"),
      labeled("Safe paths", String(preflightSummary.safeCount)),
      labeled("Blocked paths", String(preflightSummary.blockedCount))
    );

    if (preflightSummary.replacementBlockedCount > 0) {
      lines.push(labeled("Blocked regrants", String(preflightSummary.replacementBlockedCount)));
    }

    for (const result of params.preflight.slice(0, 3)) {
      lines.push(
        `${result.plannedAction.toUpperCase()} ${result.approval.tokenSymbol || result.approval.tokenAddress}`,
        labeled("Cleanup scan", result.scan.action || "safe")
      );

      if (result.replacementScan) {
        lines.push(labeled("Replacement scan", result.replacementScan.action || "safe"));
      }

      if (result.followUp) {
        lines.push(labeled("Follow-up", result.followUp));
      }
    }
  }

  if (params.brief) {
    lines.push("", "Operator brief", params.brief);
  } else if (params.briefError) {
    lines.push("", `Operator brief unavailable: ${params.briefError}`);
  }

  return lines.join("\n");
}

export function formatExecutionVerification(verification?: ExecutionVerification): string[] {
  if (!verification) {
    return [];
  }

  const lines = ["Post-run verification"];

  if (verification.error) {
    lines.push(`  Verification unavailable: ${verification.error}`);
    return lines;
  }

  if (!verification.afterSummary) {
    lines.push("  Verification unavailable.");
    return lines;
  }

  lines.push(
    `  Unlimited approvals: ${formatDelta(
      verification.beforeSummary.unlimitedApprovals,
      verification.afterSummary.unlimitedApprovals
    )}`,
    `  High-risk approvals: ${formatDelta(
      verification.beforeSummary.highRiskApprovals,
      verification.afterSummary.highRiskApprovals
    )}`,
    `  Cleanup actions remaining: ${formatDelta(
      verification.beforeCleanupCount,
      verification.afterCleanupCount ?? verification.beforeCleanupCount
    )}`,
    `  Review actions remaining: ${formatDelta(
      verification.beforeReviewCount,
      verification.afterReviewCount ?? verification.beforeReviewCount
    )}`
  );

  return lines;
}

export function formatDoctor(params: {
  address: string;
  chain?: string;
  policy: string;
  approvals: ApprovalRecord[];
  decisions: PolicyDecision[];
  preflight?: ExecuteResult[];
  recommendedCommand: string;
  brief?: string;
  briefError?: string;
}): string {
  const summary = summarizeApprovals(params.approvals);
  const health = summarizeHealth(params.decisions);
  const topFinding = params.decisions.find((decision) => decision.action !== "keep");
  const blockedPreflight = params.preflight?.some(
    (result) => result.scan.action === "block" || result.replacementScan?.action === "block"
  );
  const lines = [
    "onchainos-approval-firewall doctor",
    `Wallet: ${params.address}`,
    `Chain: ${params.chain ?? "all"}`,
    `Policy: ${params.policy}`,
    `Risk grade: ${health.grade}`,
    `Headline: ${health.headline}`,
    `Approvals: ${summary.totalApprovals} total | ${summary.unlimitedApprovals} unlimited | ${summary.highRiskApprovals} high risk`,
    `Immediate next step: ${
      blockedPreflight
        ? "Review the blocked remediation path before live execution."
        : params.recommendedCommand
    }`,
    ""
  ];

  const walletExplorerUrl = buildWalletExplorerUrl(params.address, params.chain);
  if (walletExplorerUrl) {
    lines.push(`Wallet explorer: ${walletExplorerUrl}`, "");
  }

  if (topFinding) {
    lines.push(
      "Primary finding",
      `  ${topFinding.action} ${topFinding.approval.tokenSymbol || topFinding.approval.tokenAddress}`,
      `  Why: ${topFinding.reason}`
    );
    if (topFinding.replacementAllowance) {
      lines.push(`  Exact allowance: ${topFinding.replacementAllowance}`);
    }
    lines.push("");
  } else {
    lines.push("Primary finding", "  Nothing needs action right now.", "");
  }

  if (params.preflight?.length) {
    const preflightSummary = summarizePreflight(params.preflight);
    lines.push(
      "Preflight",
      `  Safe cleanup paths: ${preflightSummary.safeCount}`,
      `  Blocked cleanup paths: ${preflightSummary.blockedCount}`,
      ""
    );
  }

  if (params.brief) {
    lines.push("Operator brief", params.brief);
  } else if (params.briefError) {
    lines.push(`Operator brief unavailable: ${params.briefError}`);
  }

  return lines.join("\n");
}
