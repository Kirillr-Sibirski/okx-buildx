import { readAuditLog } from "../lib/audit.js";

export async function auditCommand(options: {
  artifactDir?: string;
  limit?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const entries = await readAuditLog(options.artifactDir);
  const limit = options.limit ? Number.parseInt(options.limit, 10) : 10;
  const sliced = Number.isFinite(limit) && limit > 0 ? entries.slice(0, limit) : entries;

  if (options.format === "json") {
    console.log(JSON.stringify({ entries: sliced }, null, 2));
    return;
  }

  if (!sliced.length) {
    console.log("OKX Approval Firewall Audit");
    console.log("");
    console.log("No audit entries were found.");
    return;
  }

  console.log("OKX Approval Firewall Audit");
  console.log("");

  for (const entry of sliced) {
    console.log(`${entry.timestamp} | ${entry.walletAddress} | ${entry.chain} | ${entry.policy}`);
    if (entry.artifactPath) {
      console.log(`  Artifact: ${entry.artifactPath}`);
    }
    for (const result of entry.results) {
      console.log(
        `  ${result.plannedAction} ${result.approval.tokenSymbol || result.approval.tokenAddress} -> ${result.approval.spenderAddress}`
      );
      if (result.txHash) {
        console.log(`    Cleanup tx: ${result.txHash}`);
      }
      if (result.replacementTxHash) {
        console.log(`    Replacement tx: ${result.replacementTxHash}`);
      }
    }
    console.log("");
  }
}
