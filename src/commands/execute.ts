import { loadPolicyConfig } from "../lib/config.js";
import { writeExecutionArtifacts } from "../lib/audit.js";
import { buildTxExplorerUrl } from "../lib/explorer.js";
import { executeRevokeFlow, fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import type { PolicyDecision, PolicyPreset } from "../types.js";

function isCleanupDecision(
  decision: PolicyDecision
): decision is PolicyDecision & { action: "revoke" | "replace_with_exact_approval" } {
  return decision.action === "revoke" || decision.action === "replace_with_exact_approval";
}

export async function executeCommand(options: {
  address?: string;
  chain?: string;
  policy: PolicyPreset;
  config?: string;
  apply?: boolean;
  artifactDir?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const { config, path: configPath } = await loadPolicyConfig(options.config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain ?? "xlayer";
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, options.policy, config);
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

  let artifactPath: string | undefined;
  if (options.apply && results.length) {
    const artifact = await writeExecutionArtifacts({
      artifactDir: options.artifactDir,
      entry: {
        kind: "execute",
        timestamp: new Date().toISOString(),
        walletAddress: address,
        chain,
        policy: options.policy,
        configPath,
        results
      }
    });
    artifactPath = artifact.artifactPath;
  }

  if (options.format === "json") {
    console.log(
      JSON.stringify({ address, chain, apply: Boolean(options.apply), configPath, artifactPath, results }, null, 2)
    );
    return;
  }

  if (!results.length) {
    console.log("No cleanup actions were generated for the selected policy.");
    return;
  }

  console.log(
    `${options.apply ? "Applied" : "Prepared"} ${results.length} cleanup flow(s) for ${address}.`
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
}
