import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveAssistInterpretation } from "../lib/assist.js";
import { buildTxExplorerUrl, buildWalletExplorerUrl } from "../lib/explorer.js";
import { formatReview } from "../lib/format.js";
import { hasLlmCredentials } from "../lib/llm.js";
import { runExecuteWorkflow, runReviewWorkflow } from "../lib/workflows.js";
import type { ExecuteResult } from "../types.js";

const STATIC_ROOT = fileURLToPath(new URL("../../dashboard", import.meta.url));

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function sendText(
  response: import("node:http").ServerResponse,
  status: number,
  body: string,
  contentType = "text/plain; charset=utf-8"
): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

function enrichResults(results: ExecuteResult[], chain: string): Array<ExecuteResult & {
  txExplorerUrl?: string;
  replacementExplorerUrl?: string;
}> {
  return results.map((result) => ({
    ...result,
    txExplorerUrl: result.txHash ? buildTxExplorerUrl(result.txHash, chain) : undefined,
    replacementExplorerUrl: result.replacementTxHash
      ? buildTxExplorerUrl(result.replacementTxHash, chain)
      : undefined
  }));
}

async function readRequestBody(request: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(
  response: import("node:http").ServerResponse,
  relativePath: string
): Promise<void> {
  const filePath = path.join(STATIC_ROOT, relativePath);
  const content = await readFile(filePath, "utf8");
  const extension = path.extname(filePath);
  const contentType =
    extension === ".css"
      ? "text/css; charset=utf-8"
      : extension === ".js"
        ? "application/javascript; charset=utf-8"
        : "text/html; charset=utf-8";
  sendText(response, 200, content, contentType);
}

export async function dashboardCommand(options: {
  host?: string;
  port?: string;
}): Promise<void> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ? Number.parseInt(options.port, 10) : 4173;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid dashboard port: ${options.port}`);
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

      if (request.method === "GET" && url.pathname === "/") {
        await serveStatic(response, "index.html");
        return;
      }

      if (request.method === "GET" && url.pathname === "/app.js") {
        await serveStatic(response, "app.js");
        return;
      }

      if (request.method === "GET" && url.pathname === "/styles.css") {
        await serveStatic(response, "styles.css");
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          llmConfigured: hasLlmCredentials(),
          defaultPolicy: "strict",
          defaultChain: "xlayer"
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/review") {
        const review = await runReviewWorkflow({
          address: url.searchParams.get("address") || undefined,
          chain: url.searchParams.get("chain") || undefined,
          policy:
            url.searchParams.get("policy") === "minimal" || url.searchParams.get("policy") === "trading"
              ? (url.searchParams.get("policy") as "minimal" | "trading")
              : url.searchParams.get("policy") === "strict"
                ? "strict"
                : undefined,
          config: url.searchParams.get("config") || undefined,
          withBrief: url.searchParams.get("withBrief") === "1"
        });

        sendJson(response, 200, {
          ...review,
          walletExplorerUrl: buildWalletExplorerUrl(review.address, review.chain),
          preflight: enrichResults(review.preflight, review.chain ?? "xlayer"),
          formattedReview: formatReview(review)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/assist") {
        const rawBody = await readRequestBody(request);
        const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        const input = typeof body.input === "string" ? body.input : "";
        if (!input.trim()) {
          sendJson(response, 400, { ok: false, error: "input is required" });
          return;
        }

        const interpretation = await resolveAssistInterpretation({
          request: input,
          fallbackPolicy:
            body.policy === "minimal" || body.policy === "trading" || body.policy === "strict"
              ? body.policy
              : "strict",
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
          model: typeof body.model === "string" ? body.model : undefined
        });

        const review = await runReviewWorkflow({
          address: typeof body.address === "string" ? body.address : undefined,
          chain:
            typeof body.chain === "string"
              ? body.chain
              : interpretation.chain,
          policy:
            body.policy === "minimal" || body.policy === "trading" || body.policy === "strict"
              ? body.policy
              : interpretation.policy,
          config: typeof body.config === "string" ? body.config : undefined,
          withBrief:
            typeof body.withBrief === "boolean"
              ? body.withBrief
              : hasLlmCredentials(typeof body.apiKey === "string" ? body.apiKey : undefined),
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
          model: typeof body.model === "string" ? body.model : undefined
        });

        sendJson(response, 200, {
          interpretation,
          review: {
            ...review,
            walletExplorerUrl: buildWalletExplorerUrl(review.address, review.chain),
            preflight: enrichResults(review.preflight, review.chain ?? "xlayer"),
            formattedReview: formatReview(review)
          }
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/execute") {
        const rawBody = await readRequestBody(request);
        const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        const apply = Boolean(body.apply);
        if (apply && body.confirm !== true) {
          sendJson(response, 400, {
            ok: false,
            error: "Live execution requires confirm=true."
          });
          return;
        }

        const execution = await runExecuteWorkflow({
          address: typeof body.address === "string" ? body.address : undefined,
          chain: typeof body.chain === "string" ? body.chain : undefined,
          policy:
            body.policy === "minimal" || body.policy === "trading" || body.policy === "strict"
              ? body.policy
              : undefined,
          config: typeof body.config === "string" ? body.config : undefined,
          apply,
          artifactDir: typeof body.artifactDir === "string" ? body.artifactDir : undefined
        });

        sendJson(response, 200, {
          ...execution,
          walletExplorerUrl: buildWalletExplorerUrl(execution.address, execution.chain),
          results: enrichResults(execution.results, execution.chain)
        });
        return;
      }

      sendJson(response, 404, { ok: false, error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  console.log(`OKX Approval Firewall Dashboard running at http://${host}:${port}`);
  console.log("Wallet session is still required for live review and execution flows.");
}
