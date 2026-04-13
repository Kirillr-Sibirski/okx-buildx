import { formatDoctor } from "../lib/format.js";
import { hasLlmCredentials } from "../lib/llm.js";
import { runReviewWorkflow } from "../lib/workflows.js";
import type { PolicyPreset } from "../types.js";

export async function doctorCommand(options: {
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
  const withBrief = options.withBrief ?? hasLlmCredentials(options.apiKey);
  const result = await runReviewWorkflow({
    ...options,
    withBrief
  });

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatDoctor(result));
}
