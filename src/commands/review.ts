import { loadPolicyConfig, resolvePolicyPreset } from "../lib/config.js";
import { formatReview } from "../lib/format.js";
import { generateOperatorBrief } from "../lib/brief.js";
import { executeRevokeFlow, fetchApprovals, resolveDefaultAddress } from "../lib/okx.js";
import { buildPolicyDecisions } from "../lib/policy.js";
import { buildRecommendedCommand, recommendNextIntent } from "../lib/runbook.js";
import type { PolicyDecision, PolicyPreset } from "../types.js";

function isCleanupDecision(
  decision: PolicyDecision
): decision is PolicyDecision & { action: "revoke" | "replace_with_exact_approval" } {
  return decision.action === "revoke" || decision.action === "replace_with_exact_approval";
}

export async function reviewCommand(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  withBrief?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  format?: "pretty" | "json";
}): Promise<void> {
  const { config, path: configPath } = await loadPolicyConfig(options.config);
  const policy = resolvePolicyPreset(options.policy, config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain;
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, policy, config);
  const cleanupTargets = decisions
    .filter(isCleanupDecision)
    .map((decision) => ({
      approval: decision.approval,
      plannedAction: decision.action,
      replacementAllowance: decision.replacementAllowance
    }));
  const preflight = cleanupTargets.length
    ? await executeRevokeFlow({
        approvals: cleanupTargets,
        chain: chain ?? "xlayer",
        from: address,
        apply: false
      })
    : [];
  const nextIntent = recommendNextIntent(decisions, preflight);
  const recommendedCommand = buildRecommendedCommand({
    intent: nextIntent,
    policy,
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
        policy,
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
          policy,
          configPath,
          approvals,
          decisions,
          preflight,
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
      policy,
      configPath,
      approvals,
      decisions,
      preflight,
      recommendedCommand,
      brief,
      briefError
    })
  );
}
