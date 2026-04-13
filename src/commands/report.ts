import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadPolicyConfig, resolvePolicyPreset } from "../lib/config.js";
import { formatMarkdownReport } from "../lib/format.js";
import { fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import type { PolicyPreset } from "../types.js";

export async function reportCommand(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  format?: "markdown" | "json";
  output?: string;
}): Promise<void> {
  const { config, path: configPath } = await loadPolicyConfig(options.config);
  const policy = resolvePolicyPreset(options.policy, config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain;
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, policy, config);

  if (options.format === "json") {
    const payload = { address, chain, policy, configPath, approvals, decisions };
    const content = JSON.stringify(payload, null, 2);
    if (options.output) {
      const outputPath = path.resolve(options.output);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
    }
    console.log(content);
    return;
  }

  const content = formatMarkdownReport(approvals, decisions, policy);
  if (options.output) {
    const outputPath = path.resolve(options.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
  }
  console.log(content);
}
