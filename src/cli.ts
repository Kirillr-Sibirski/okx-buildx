#!/usr/bin/env node
import { Command } from "commander";

import { auditCommand } from "./commands/audit.js";
import { executeCommand } from "./commands/execute.js";
import { inspectCommand } from "./commands/inspect.js";
import { planCommand } from "./commands/plan.js";
import { reportCommand } from "./commands/report.js";
import { statusCommand } from "./commands/status.js";
import type { PolicyPreset } from "./types.js";

const program = new Command();

function parsePolicy(value: string): PolicyPreset {
  if (value === "strict" || value === "minimal" || value === "trading") {
    return value;
  }
  throw new Error(`Unsupported policy preset: ${value}`);
}

program
  .name("okx-approval-firewall")
  .description("Agent-native approval and allowance firewall for X Layer agents.")
  .version("0.1.0");

program
  .command("status")
  .description("Show a one-screen approval health summary for a wallet.")
  .requiredOption("--policy <policy>", "Policy preset: strict, minimal, trading.", parsePolicy)
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await statusCommand(options);
  });

program
  .command("inspect")
  .description("Inspect approval exposure for a wallet.")
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await inspectCommand(options);
  });

program
  .command("plan")
  .description("Generate policy-driven approval actions.")
  .requiredOption("--policy <policy>", "Policy preset: strict, minimal, trading.", parsePolicy)
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await planCommand(options);
  });

program
  .command("report")
  .description("Render a report from approvals and policy decisions.")
  .requiredOption("--policy <policy>", "Policy preset: strict, minimal, trading.", parsePolicy)
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--format <format>", "Output format: markdown or json.", "markdown")
  .option("--output <path>", "Optional output file path for the report artifact.")
  .action(async (options) => {
    await reportCommand(options);
  });

program
  .command("execute")
  .description("Run cleanup flows for approvals marked for removal or reduction.")
  .requiredOption("--policy <policy>", "Policy preset: strict, minimal, trading.", parsePolicy)
  .option("--chain <chain>", "Chain name or chain id used for tx-scan and contract execution.")
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--apply", "Actually submit revoke calls through Agentic Wallet.")
  .option("--artifact-dir <path>", "Directory for execution audit artifacts.", ".okx-approval-firewall")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await executeCommand(options);
  });

program
  .command("audit")
  .description("Review recent local execution artifacts.")
  .option("--artifact-dir <path>", "Directory for execution audit artifacts.", ".okx-approval-firewall")
  .option("--limit <n>", "Number of entries to display.", "10")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await auditCommand(options);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
