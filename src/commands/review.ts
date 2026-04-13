import { formatReview } from "../lib/format.js";
import { runReviewWorkflow } from "../lib/workflows.js";
import type { PolicyPreset } from "../types.js";

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
  const result = await runReviewWorkflow(options);

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    formatReview({
      ...result
    })
  );
}
