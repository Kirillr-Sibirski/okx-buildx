import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { PolicyConfig, PolicyPreset, SpenderPolicy } from "../types.js";

const DEFAULT_CONFIG_PATHS = [
  "okx-approval-firewall.policy.json",
  ".okx-approval-firewall/policy.json"
];

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeSpenderPolicy(policy: unknown): SpenderPolicy {
  const value = (policy ?? {}) as Record<string, unknown>;
  const notes = Array.isArray(value.notes)
    ? value.notes.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    label: typeof value.label === "string" ? value.label : undefined,
    trust:
      value.trust === "trusted" || value.trust === "watchlist" || value.trust === "blocked"
        ? value.trust
        : undefined,
    maxAllowance: typeof value.maxAllowance === "string" ? value.maxAllowance : undefined,
    exactAllowance: typeof value.exactAllowance === "string" ? value.exactAllowance : undefined,
    notes
  };
}

function normalizeConfig(raw: unknown): PolicyConfig {
  const value = (raw ?? {}) as Record<string, unknown>;
  const spenders: Record<string, SpenderPolicy> = {};
  const defaultsValue =
    typeof value.defaults === "object" && value.defaults !== null
      ? (value.defaults as Record<string, unknown>)
      : undefined;
  const policyValue = defaultsValue?.policy;

  if (typeof value.spenders === "object" && value.spenders !== null) {
    for (const [spender, policy] of Object.entries(value.spenders as Record<string, unknown>)) {
      spenders[normalizeAddress(spender)] = normalizeSpenderPolicy(policy);
    }
  }

  const defaults =
    defaultsValue
      ? {
          chain:
            typeof defaultsValue.chain === "string"
              ? String(defaultsValue.chain)
              : undefined,
          policy:
            policyValue === "strict" || policyValue === "minimal" || policyValue === "trading"
              ? (policyValue as PolicyPreset)
              : undefined
        }
      : undefined;

  return {
    defaults,
    spenders: Object.keys(spenders).length ? spenders : undefined
  };
}

export async function loadPolicyConfig(
  explicitPath?: string
): Promise<{ config?: PolicyConfig; path?: string }> {
  const candidates = explicitPath
    ? [path.resolve(explicitPath)]
    : DEFAULT_CONFIG_PATHS.map((candidate) => path.resolve(candidate));

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }

    const raw = await readFile(candidate, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return {
      config: normalizeConfig(parsed),
      path: candidate
    };
  }

  return {};
}

export function getSpenderPolicy(
  config: PolicyConfig | undefined,
  spenderAddress: string
): SpenderPolicy | undefined {
  return config?.spenders?.[normalizeAddress(spenderAddress)];
}
