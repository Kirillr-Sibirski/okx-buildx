import { buildTxExplorerUrl } from "../lib/explorer.js";
import { formatExecutionVerification } from "../lib/format.js";
import { runExecuteWorkflow } from "../lib/workflows.js";
import type { PolicyPreset } from "../types.js";

export async function executeCommand(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  apply?: boolean;
  artifactDir?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const result = await runExecuteWorkflow(options);

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.results.length) {
    console.log("No cleanup actions were generated for the selected policy.");
    return;
  }

  const successfulCount = result.results.filter((item) => Boolean(item.txHash)).length;
  const blockedCount = result.results.filter((item) => item.scan.action === "block").length;
  const failedCount = result.results.filter((item) => Boolean(item.error)).length;

  console.log(
    `${result.apply ? "Applied" : "Prepared"} ${result.results.length} cleanup flow(s) for ${result.address}.`
  );
  console.log(
    `Execution summary: ${successfulCount} submitted | ${blockedCount} blocked by tx-scan | ${failedCount} failed`
  );
  console.log("");
  if (result.artifactPath) {
    console.log(`Audit artifact: ${result.artifactPath}`);
    console.log("");
  }

  for (const item of result.results) {
    console.log(`Token: ${item.approval.tokenSymbol || item.approval.tokenAddress}`);
    console.log(`Spender: ${item.approval.spenderAddress}`);
    console.log(`Policy action: ${item.plannedAction}`);
    console.log(`Scan action: ${item.scan.action || "safe"}`);
    if (item.scan.simulator?.revertReason) {
      console.log(`Revert reason: ${item.scan.simulator.revertReason}`);
    }
    console.log(`Command: ${item.command.join(" ")}`);
    if (item.txHash) {
      console.log(`Tx hash: ${item.txHash}`);
      const txExplorerUrl = buildTxExplorerUrl(item.txHash, result.chain);
      if (txExplorerUrl) {
        console.log(`Explorer: ${txExplorerUrl}`);
      }
    }
    if (item.replacementCommand) {
      console.log(`Replacement command: ${item.replacementCommand.join(" ")}`);
    }
    if (item.replacementScan) {
      console.log(`Replacement scan action: ${item.replacementScan.action || "safe"}`);
    }
    if (item.replacementTxHash) {
      console.log(`Replacement tx hash: ${item.replacementTxHash}`);
      const replacementExplorerUrl = buildTxExplorerUrl(item.replacementTxHash, result.chain);
      if (replacementExplorerUrl) {
        console.log(`Replacement explorer: ${replacementExplorerUrl}`);
      }
    }
    if (item.followUp) {
      console.log(`Follow-up: ${item.followUp}`);
    }
    if (item.error) {
      console.log(`Error: ${item.error}`);
    }
    console.log("");
  }

  const verificationLines = formatExecutionVerification(result.verification);
  if (verificationLines.length) {
    for (const line of verificationLines) {
      console.log(line);
    }
    console.log("");
  }
}
