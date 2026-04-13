import { createChatCompletion, hasLlmCredentials } from "./llm.js";

import type { PolicyPreset } from "../types.js";

export type AssistIntent = "status" | "inspect" | "plan" | "report" | "execute";

export interface AssistInterpretation {
  request: string;
  normalizedRequest: string;
  intent: AssistIntent;
  policy: PolicyPreset;
  chain?: string;
  requestedApply: boolean;
  rationale: string;
  source: "heuristic" | "model";
}

function includesAny(input: string, patterns: string[]): boolean {
  return patterns.some((pattern) => input.includes(pattern));
}

function detectPolicy(input: string, fallbackPolicy: PolicyPreset): {
  policy: PolicyPreset;
  reason?: string;
} {
  if (includesAny(input, [" trading ", " trader ", " router ", " active workflow "])) {
    return {
      policy: "trading",
      reason: "Detected trading-oriented language, so the trading preset is the best fit."
    };
  }

  if (includesAny(input, [" minimal ", " minimal-risk ", " minimal risk ", " low touch "])) {
    return {
      policy: "minimal",
      reason: "Detected low-touch language, so the minimal preset is the best fit."
    };
  }

  if (includesAny(input, [" strict ", " safest ", " lock it down ", " harden "])) {
    return {
      policy: "strict",
      reason: "Detected strict or hardening language, so the strict preset is the best fit."
    };
  }

  return {
    policy: fallbackPolicy
  };
}

function detectIntent(input: string): {
  intent: AssistIntent;
  reason: string;
} {
  if (includesAny(input, ["report", "artifact", "markdown", "json report"])) {
    return {
      intent: "report",
      reason: "The request asks for a report or artifact."
    };
  }

  if (
    includesAny(input, [
      "clean up",
      "cleanup",
      "remediate",
      "revoke",
      "fix approvals",
      "apply the fix",
      "execute"
    ])
  ) {
    return {
      intent: "execute",
      reason: "The request asks to remediate, revoke, or execute cleanup."
    };
  }

  if (
    includesAny(input, [
      "what should",
      "plan",
      "suggest",
      "recommend",
      "what do i do",
      "what needs"
    ])
  ) {
    return {
      intent: "plan",
      reason: "The request asks for a recommendation or plan."
    };
  }

  if (
    includesAny(input, [
      "inspect",
      "show approvals",
      "list approvals",
      "approval inventory",
      "exposure"
    ])
  ) {
    return {
      intent: "inspect",
      reason: "The request asks to inspect raw approval exposure."
    };
  }

  return {
    intent: "status",
    reason: "Defaulting to a wallet health summary because the request reads like a safety or status check."
  };
}

function detectChain(input: string): {
  chain?: string;
  reason?: string;
} {
  if (includesAny(input, ["x layer", "xlayer", "chain 196", "chain id 196"])) {
    return {
      chain: "xlayer",
      reason: "Detected an explicit reference to X Layer."
    };
  }

  return {};
}

function detectRequestedApply(input: string): boolean {
  return includesAny(input, [
    "do it now",
    "apply the fix",
    "execute now",
    "clean it up",
    "revoke it",
    "fix it now",
    "remediate now"
  ]);
}

export function interpretAssistRequest(
  request: string,
  fallbackPolicy: PolicyPreset = "strict"
): AssistInterpretation {
  const normalizedRequest = ` ${request.trim().toLowerCase().replace(/\s+/g, " ")} `;
  const { intent, reason: intentReason } = detectIntent(normalizedRequest);
  const { policy, reason: policyReason } = detectPolicy(normalizedRequest, fallbackPolicy);
  const { chain, reason: chainReason } = detectChain(normalizedRequest);
  const requestedApply = detectRequestedApply(normalizedRequest);
  const rationale = [intentReason, policyReason, chainReason]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return {
    request,
    normalizedRequest,
    intent,
    policy,
    chain,
    requestedApply,
    rationale,
    source: "heuristic"
  };
}

export function buildAssistPrompt(request: string, fallbackPolicy: PolicyPreset): string {
  return [
    "Interpret the following approval-firewall operator request.",
    "Return strict JSON only.",
    "Schema:",
    "{",
    '  "intent": "status | inspect | plan | report | execute",',
    '  "policy": "strict | minimal | trading",',
    '  "chain": "xlayer | null",',
    '  "requestedApply": true,',
    '  "rationale": "short explanation"',
    "}",
    "",
    "Rules:",
    "- Prefer status for general health checks.",
    "- Prefer plan when the user asks what should happen next.",
    "- Prefer execute only when the user clearly asks to remediate or revoke.",
    "- Use chain=xlayer when the user references X Layer or chain 196.",
    "- requestedApply should be true only when the user clearly asks for live execution now.",
    `- If uncertain on policy, use ${fallbackPolicy}.`,
    "",
    `Request: ${request}`
  ].join("\n");
}

function parseModelInterpretation(
  raw: string,
  request: string,
  fallbackPolicy: PolicyPreset
): AssistInterpretation {
  const parsed = JSON.parse(raw) as {
    intent?: AssistIntent;
    policy?: PolicyPreset;
    chain?: string | null;
    requestedApply?: boolean;
    rationale?: string;
  };

  if (
    parsed.intent !== "status" &&
    parsed.intent !== "inspect" &&
    parsed.intent !== "plan" &&
    parsed.intent !== "report" &&
    parsed.intent !== "execute"
  ) {
    throw new Error("Model returned an unsupported intent.");
  }

  const policy =
    parsed.policy === "strict" || parsed.policy === "minimal" || parsed.policy === "trading"
      ? parsed.policy
      : fallbackPolicy;

  return {
    request,
    normalizedRequest: ` ${request.trim().toLowerCase().replace(/\s+/g, " ")} `,
    intent: parsed.intent,
    policy,
    chain: parsed.chain === "xlayer" ? "xlayer" : undefined,
    requestedApply: Boolean(parsed.requestedApply),
    rationale: parsed.rationale?.trim() || "Model-backed interpretation selected the safest matching workflow.",
    source: "model"
  };
}

export async function resolveAssistInterpretation(params: {
  request: string;
  fallbackPolicy?: PolicyPreset;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<AssistInterpretation> {
  const fallbackPolicy = params.fallbackPolicy ?? "strict";
  const heuristic = interpretAssistRequest(params.request, fallbackPolicy);

  if (!hasLlmCredentials(params.apiKey)) {
    return heuristic;
  }

  try {
    const content = await createChatCompletion({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      model: params.model,
      temperature: 0,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a security-focused approval firewall copilot. Return JSON only and bias toward the safest interpretation."
        },
        {
          role: "user",
          content: buildAssistPrompt(params.request, fallbackPolicy)
        }
      ]
    });

    return parseModelInterpretation(content, params.request, fallbackPolicy);
  } catch {
    return heuristic;
  }
}
