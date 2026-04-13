#!/usr/bin/env node
import { Command } from "commander";

import { briefCommand } from "./commands/brief.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { doctorCommand } from "./commands/doctor.js";
import { reviewCommand } from "./commands/review.js";
import { assistCommand } from "./commands/assist.js";
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
  .command("doctor")
  .description("Run the safest guided approval-health check with one recommended next step.")
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--with-brief", "Attempt a model-backed operator brief in the same guided check.")
  .option("--api-key <key>", "Optional API key override for an OpenAI-compatible chat-completions endpoint.")
  .option("--base-url <url>", "Optional OpenAI-compatible API base URL.")
  .option("--model <model>", "Optional model override.")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await doctorCommand(options);
  });

program
  .command("dashboard")
  .description("Launch the local Approval Firewall dashboard.")
  .option("--host <host>", "Dashboard host.", "127.0.0.1")
  .option("--port <port>", "Dashboard port.", "4173")
  .action(async (options) => {
    await dashboardCommand(options);
  });

program
  .command("review")
  .description("Run a complete approval review with top findings and the safest next command.")
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--with-brief", "Attempt a model-backed operator brief in the same review.")
  .option("--api-key <key>", "Optional API key override for an OpenAI-compatible chat-completions endpoint.")
  .option("--base-url <url>", "Optional OpenAI-compatible API base URL.")
  .option("--model <model>", "Optional model override.")
  .option("--format <format>", "Output format: pretty or json.", "pretty")
  .action(async (options) => {
    await reviewCommand(options);
  });

program
  .command("brief")
  .description("Generate a model-backed operator briefing from live approval state.")
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--api-key <key>", "Optional API key override for an OpenAI-compatible chat-completions endpoint.")
  .option("--base-url <url>", "Optional OpenAI-compatible API base URL.")
  .option("--model <model>", "Optional model override.")
  .action(async (options) => {
    await briefCommand(options);
  });

program
  .command("assist")
  .description("Interpret a natural-language request and route it to the safest matching workflow.")
  .requiredOption("--input <text>", "Natural-language request for approval inspection, planning, reporting, or cleanup.")
  .option("--address <address>", "Wallet address. Falls back to the active Agentic Wallet EVM address.")
  .option("--chain <chain>", "Chain name or chain id to pass through to OnchainOS.")
  .option("--policy <policy>", "Optional policy preset override: strict, minimal, trading.", parsePolicy)
  .option("--config <path>", "Optional path to a local policy config JSON file.")
  .option("--apply", "Actually submit revoke calls through Agentic Wallet when the request maps to execute.")
  .option("--output <path>", "Optional output path when the request maps to report.")
  .option("--api-key <key>", "Optional API key override for an OpenAI-compatible chat-completions endpoint.")
  .option("--base-url <url>", "Optional OpenAI-compatible API base URL.")
  .option("--model <model>", "Optional model override.")
  .action(async (options) => {
    await assistCommand(options);
  });

program
  .command("status")
  .description("Show a one-screen approval health summary for a wallet.")
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
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
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
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
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
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
  .option("--policy <policy>", "Policy preset: strict, minimal, trading. Defaults to config or strict.", parsePolicy)
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
