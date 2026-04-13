import { loadPolicyConfig } from "../lib/config.js";
import { formatReview } from "../lib/format.js";
import { generateOperatorBrief } from "../lib/brief.js";
import { fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import { buildRecommendedCommand, recommendNextIntent } from "../lib/runbook.js";
import type { PolicyPreset } from "../types.js";

export async function reviewCommand(options: {
  address?: string;
  chain?: string;
  policy: PolicyPreset;
  config?: string;
  withBrief?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const { config, path: configPath } = await loadPolicyConfig(options.config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain;
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, options.policy, config);
  const nextIntent = recommendNextIntent(decisions);
  const recommendedCommand = buildRecommendedCommand({
    intent: nextIntent,
    policy: options.policy,
    address,
    chain,
    config: configPath,
    apply: nextIntent === "execute"
  });

  let brief: string | undefined;
  let briefError: string | undefined;
  if (options.withBrief) {
    try {
      brief = await generateOperatorBrief({
        address,
        chain,
        policy: options.policy,
        approvals,
        decisions,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model
      });
    } catch (error) {
      briefError = error instanceof Error ? error.message : String(error);
    }
  }

  if (options.format === "json") {
    console.log(
      JSON.stringify(
        {
          address,
          chain,
          policy: options.policy,
          configPath,
          approvals,
          decisions,
          recommendedCommand,
          brief,
          briefError
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    formatReview({
      address,
      chain,
      policy: options.policy,
      configPath,
      approvals,
      decisions,
      recommendedCommand,
      brief,
      briefError
    })
  );
}
