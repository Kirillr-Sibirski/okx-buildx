import { executeCommand } from "./execute.js";
import { inspectCommand } from "./inspect.js";
import { planCommand } from "./plan.js";
import { reportCommand } from "./report.js";
import { doctorCommand } from "./doctor.js";
import { reviewCommand } from "./review.js";
import { statusCommand } from "./status.js";
import { resolveAssistInterpretation } from "../lib/assist.js";
import { hasLlmCredentials } from "../lib/llm.js";
import { buildRecommendedCommand } from "../lib/runbook.js";
import type { PolicyPreset } from "../types.js";

export async function assistCommand(options: {
  input: string;
  address?: string;
  chain?: string;
  policy?: PolicyPreset;
  config?: string;
  apply?: boolean;
  output?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<void> {
  const interpretation = await resolveAssistInterpretation({
    request: options.input,
    fallbackPolicy: options.policy ?? "strict",
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model
  });
  const policy = options.policy ?? interpretation.policy;
  const chain = options.chain ?? interpretation.chain;
  const apply = Boolean(options.apply);
  const withBrief = hasLlmCredentials(options.apiKey);
  const recommendedCommand = buildRecommendedCommand({
    intent: interpretation.intent,
    policy,
    address: options.address,
    chain,
    config: options.config,
    apply,
    output: options.output
  });

  console.log("OKX Approval Firewall Assist");
  console.log(`Request: ${interpretation.request}`);
  console.log(`Interpreted intent: ${interpretation.intent}`);
  console.log(`Policy preset: ${policy}`);
  console.log(`Chain: ${chain ?? "default"}`);
  console.log(`Safety mode: ${apply ? "live apply enabled" : "dry run only"}`);
  console.log(`Interpretation source: ${interpretation.source}`);
  console.log(`Why: ${interpretation.rationale}`);
  console.log(`Recommended command: ${recommendedCommand}`);
  console.log("");

  if (interpretation.requestedApply && !apply) {
    console.log(
      "Note: the request sounds like a live remediation, but Assist will stay in dry-run mode until you add --apply."
    );
    console.log("");
  }

  if (interpretation.intent === "status") {
    await statusCommand({
      address: options.address,
      chain,
      policy,
      config: options.config,
      format: "pretty"
    });
    return;
  }

  if (interpretation.intent === "doctor") {
    await doctorCommand({
      address: options.address,
      chain,
      policy,
      config: options.config,
      withBrief,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      format: "pretty"
    });
    return;
  }

  if (interpretation.intent === "review") {
    await reviewCommand({
      address: options.address,
      chain,
      policy,
      config: options.config,
      withBrief,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      format: "pretty"
    });
    return;
  }

  if (interpretation.intent === "inspect") {
    await inspectCommand({
      address: options.address,
      chain,
      config: options.config,
      format: "pretty"
    });
    return;
  }

  if (interpretation.intent === "plan") {
    await planCommand({
      address: options.address,
      chain,
      policy,
      config: options.config,
      format: "pretty"
    });
    return;
  }

  if (interpretation.intent === "report") {
    await reportCommand({
      address: options.address,
      chain,
      policy,
      config: options.config,
      format: "markdown",
      output: options.output
    });
    return;
  }

  await executeCommand({
    address: options.address,
    chain,
    policy,
    config: options.config,
    apply,
    format: "pretty"
  });
}
