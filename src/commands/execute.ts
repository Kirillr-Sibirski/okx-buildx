import { loadPolicyConfig, resolvePolicyPreset } from "../lib/config.js";
import { writeExecutionArtifacts } from "../lib/audit.js";
import { buildTxExplorerUrl } from "../lib/explorer.js";
import { formatExecutionVerification, summarizeActionCounts, summarizeApprovals } from "../lib/format.js";
import { executeRevokeFlow, fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import type { ExecutionVerification, PolicyDecision, PolicyPreset } from "../types.js";

function isCleanupDecision(
  decision: PolicyDecision
): decision is PolicyDecision & { action: "revoke" | "replace_with_exact_approval" } {
  return decision.action === "revoke" || decision.action === "replace_with_exact_approval";
}

export async function executeCommand(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  apply?: boolean;
  artifactDir?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const { config, path: configPath } = await loadPolicyConfig(options.config);
  const policy = resolvePolicyPreset(options.policy, config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain ?? "xlayer";
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, policy, config);
  const beforeSummary = summarizeApprovals(approvals);
  const beforeActions = summarizeActionCounts(decisions);
  const cleanupTargets = decisions
    .filter(isCleanupDecision)
    .map((decision) => ({
      approval: decision.approval,
      plannedAction: decision.action,
      replacementAllowance: decision.replacementAllowance
    }));

  const results = await executeRevokeFlow({
    approvals: cleanupTargets,
    chain,
    from: address,
    apply: Boolean(options.apply)
  });

  let verification: ExecutionVerification | undefined;
  if (options.apply && results.length) {
    try {
      const afterApprovals = await fetchApprovals({ address, chain });
      const afterDecisions = buildPolicyDecisions(afterApprovals, policy, config);
      const afterSummary = summarizeApprovals(afterApprovals);
      const afterActions = summarizeActionCounts(afterDecisions);

      verification = {
        beforeSummary,
        afterSummary,
        beforeActionableCount: beforeActions.actionableCount,
        afterActionableCount: afterActions.actionableCount,
        beforeCleanupCount: beforeActions.cleanupCount,
        afterCleanupCount: afterActions.cleanupCount,
        beforeReviewCount: beforeActions.reviewCount,
        afterReviewCount: afterActions.reviewCount
      };
    } catch (error) {
      verification = {
        beforeSummary,
        beforeActionableCount: beforeActions.actionableCount,
        beforeCleanupCount: beforeActions.cleanupCount,
        beforeReviewCount: beforeActions.reviewCount,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  let artifactPath: string | undefined;
  if (options.apply && results.length) {
    const artifact = await writeExecutionArtifacts({
      artifactDir: options.artifactDir,
      entry: {
        kind: "execute",
        timestamp: new Date().toISOString(),
        walletAddress: address,
        chain,
        policy,
        configPath,
        results,
        verification
      }
    });
    artifactPath = artifact.artifactPath;
  }

  if (options.format === "json") {
    console.log(
      JSON.stringify(
        { address, chain, apply: Boolean(options.apply), configPath, artifactPath, results, verification },
        null,
        2
      )
    );
    return;
  }

  if (!results.length) {
    console.log("No cleanup actions were generated for the selected policy.");
    return;
  }

  const successfulCount = results.filter((result) => Boolean(result.txHash)).length;
  const blockedCount = results.filter((result) => result.scan.action === "block").length;
  const failedCount = results.filter((result) => Boolean(result.error)).length;

  console.log(`${options.apply ? "Applied" : "Prepared"} ${results.length} cleanup flow(s) for ${address}.`);
  console.log(
    `Execution summary: ${successfulCount} submitted | ${blockedCount} blocked by tx-scan | ${failedCount} failed`
  );
  console.log("");
  if (artifactPath) {
    console.log(`Audit artifact: ${artifactPath}`);
    console.log("");
  }

  for (const result of results) {
    console.log(`Token: ${result.approval.tokenSymbol || result.approval.tokenAddress}`);
    console.log(`Spender: ${result.approval.spenderAddress}`);
    console.log(`Policy action: ${result.plannedAction}`);
    console.log(`Scan action: ${result.scan.action || "safe"}`);
    if (result.scan.simulator?.revertReason) {
      console.log(`Revert reason: ${result.scan.simulator.revertReason}`);
    }
    console.log(`Command: ${result.command.join(" ")}`);
    if (result.txHash) {
      console.log(`Tx hash: ${result.txHash}`);
      const txExplorerUrl = buildTxExplorerUrl(result.txHash, chain);
      if (txExplorerUrl) {
        console.log(`Explorer: ${txExplorerUrl}`);
      }
    }
    if (result.replacementCommand) {
      console.log(`Replacement command: ${result.replacementCommand.join(" ")}`);
    }
    if (result.replacementScan) {
      console.log(`Replacement scan action: ${result.replacementScan.action || "safe"}`);
    }
    if (result.replacementTxHash) {
      console.log(`Replacement tx hash: ${result.replacementTxHash}`);
      const replacementExplorerUrl = buildTxExplorerUrl(result.replacementTxHash, chain);
      if (replacementExplorerUrl) {
        console.log(`Replacement explorer: ${replacementExplorerUrl}`);
      }
    }
    if (result.followUp) {
      console.log(`Follow-up: ${result.followUp}`);
    }
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    console.log("");
  }

  const verificationLines = formatExecutionVerification(verification);
  if (verificationLines.length) {
    for (const line of verificationLines) {
      console.log(line);
    }
    console.log("");
  }
}
