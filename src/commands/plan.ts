import { formatPlan } from "../lib/format.js";
import { loadPolicyConfig, resolvePolicyPreset } from "../lib/config.js";
import { fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import type { PolicyPreset } from "../types.js";

export async function planCommand(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const { config, path } = await loadPolicyConfig(options.config);
  const policy = resolvePolicyPreset(options.policy, config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain;
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, policy, config);

  if (options.format === "json") {
    console.log(JSON.stringify({ address, chain, policy, configPath: path, decisions }, null, 2));
    return;
  }

  console.log(formatPlan(decisions));
}
