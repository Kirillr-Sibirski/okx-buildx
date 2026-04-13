import { loadPolicyConfig, resolvePolicyPreset } from "./config.js";
import { summarizeActionCounts, summarizeApprovals } from "./format.js";
import { generateOperatorBrief } from "./brief.js";
import { writeExecutionArtifacts } from "./audit.js";
import { buildPolicyDecisions } from "./policy.js";
import { buildRecommendedCommand, recommendNextIntent } from "./runbook.js";
import { executeRevokeFlow, fetchApprovals, resolveDefaultAddress } from "./okx.js";

import type { ExecutionVerification, PolicyDecision, PolicyPreset } from "../types.js";

function isCleanupDecision(
  decision: PolicyDecision
): decision is PolicyDecision & { action: "revoke" | "replace_with_exact_approval" } {
  return decision.action === "revoke" || decision.action === "replace_with_exact_approval";
}

export interface ReviewWorkflowResult {
  address: string;
  chain?: string;
  policy: PolicyPreset;
  configPath?: string;
  approvals: Awaited<ReturnType<typeof fetchApprovals>>;
  decisions: ReturnType<typeof buildPolicyDecisions>;
  preflight: Awaited<ReturnType<typeof executeRevokeFlow>>;
  recommendedCommand: string;
  brief?: string;
  briefError?: string;
}

export async function runReviewWorkflow(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  withBrief?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<ReviewWorkflowResult> {
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

  return {
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
  };
}

export interface ExecuteWorkflowResult {
  address: string;
  chain: string;
  policy: PolicyPreset;
  configPath?: string;
  apply: boolean;
  artifactPath?: string;
  results: Awaited<ReturnType<typeof executeRevokeFlow>>;
  verification?: ExecutionVerification;
}

export async function runExecuteWorkflow(options: {
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  apply?: boolean;
  artifactDir?: string;
}): Promise<ExecuteWorkflowResult> {
  const { config, path: configPath } = await loadPolicyConfig(options.config);
  const policy = resolvePolicyPreset(options.policy, config);
  const address = options.address ?? (await resolveDefaultAddress());
  const chain = options.chain ?? config?.defaults?.chain ?? "xlayer";
  const approvals = await fetchApprovals({ address, chain });
  const decisions = buildPolicyDecisions(approvals, policy, config);
  const beforeSummary = summarizeApprovals(approvals);
  const beforeActions = summarizeActionCounts(decisions);
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

  let verification: ExecutionVerification | undefined;
  if (options.apply && results.length) {
    try {
      const afterApprovals = await fetchApprovals({ address, chain });
      const afterDecisions = buildPolicyDecisions(afterApprovals, policy, config);
      const afterSummary = summarizeApprovals(afterApprovals);
      const afterActions = summarizeActionCounts(afterDecisions);

      verification = {
        beforeSummary,
        afterSummary,
        beforeActionableCount: beforeActions.actionableCount,
        afterActionableCount: afterActions.actionableCount,
        beforeCleanupCount: beforeActions.cleanupCount,
        afterCleanupCount: afterActions.cleanupCount,
        beforeReviewCount: beforeActions.reviewCount,
        afterReviewCount: afterActions.reviewCount
      };
    } catch (error) {
      verification = {
        beforeSummary,
        beforeActionableCount: beforeActions.actionableCount,
        beforeCleanupCount: beforeActions.cleanupCount,
        beforeReviewCount: beforeActions.reviewCount,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  let artifactPath: string | undefined;
  if (options.apply && results.length) {
    const artifact = await writeExecutionArtifacts({
      artifactDir: options.artifactDir,
      entry: {
        kind: "execute",
        timestamp: new Date().toISOString(),
        walletAddress: address,
        chain,
        policy,
        configPath,
        results,
        verification
      }
    });
    artifactPath = artifact.artifactPath;
  }

  return {
    address,
    chain,
    policy,
    configPath,
    apply: Boolean(options.apply),
    artifactPath,
    results,
    verification
  };
}
