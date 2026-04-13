import { loadPolicyConfig, resolvePolicyPreset } from "../lib/config.js";
import { fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import { generateOperatorBrief } from "../lib/brief.js";
import type { PolicyPreset } from "../types.js";

export async function briefCommand(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<void> {
  const { config } = await loadPolicyConfig(options.config);
  const policy = resolvePolicyPreset(options.policy, config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain;
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, policy, config);
  const content = await generateOperatorBrief({
    address,
    chain,
    policy,
    approvals,
    decisions,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model
  });

  console.log(content);
}
