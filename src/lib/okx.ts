import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { encodeFunctionData } from "viem";

import type { ApprovalRecord, ExecuteResult, ScanResult } from "../types.js";

const execFileAsync = promisify(execFile);
const MAX_UINT256 = (1n << 256n) - 1n;
const CONTRACT_CALL_RETRIES = 3;

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

function unwrapData<T>(value: unknown): T {
  if (typeof value === "object" && value !== null && "data" in value) {
    return (value as { data: T }).data;
  }
  return value as T;
}

function extractOnchainOsError(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok?: boolean }).ok === false &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  ) {
    return (value as { error: string }).error;
  }

  return undefined;
}

function parseJsonOutput(stdout: string, stderr: string, args: string[]): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`Command returned no JSON output: onchainos ${args.join(" ")}\n${stderr}`);
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from onchainos ${args.join(" ")}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n${String(error)}`
    );
  }
}

function normalizeChain(chain: string): string {
  const value = chain.trim().toLowerCase().replace(/[\s_]+/g, "");
  if (value === "xlayer" || value === "196") {
    return "xlayer";
  }
  return value;
}

function parseUnlimitedFlag(record: Record<string, unknown>, allowance: string): boolean {
  if (allowance.toLowerCase() === "unlimited") {
    return true;
  }

  const candidates = [
    record.allowance,
    record.remainAmount,
    record.remainAmtPrecise
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }

    const normalized = candidate.trim().toLowerCase();
    if (normalized === "unlimited") {
      return true;
    }

    if (!/^\d+$/.test(normalized)) {
      continue;
    }

    try {
      if (BigInt(normalized) === MAX_UINT256) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

async function runJsonCommand(args: string[]): Promise<unknown> {
  try {
    const { stdout, stderr } = await execFileAsync("onchainos", args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4
    });
    const parsed = parseJsonOutput(stdout, stderr, args);
    const commandError = extractOnchainOsError(parsed);
    if (commandError) {
      throw new Error(commandError);
    }

    return parsed;
  } catch (error) {
    const stdout =
      typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string"
        ? error.stdout
        : "";
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr
        : "";

    if (stdout.trim()) {
      const parsed = parseJsonOutput(stdout, stderr, args);
      const commandError = extractOnchainOsError(parsed);
      if (commandError) {
        throw new Error(commandError);
      }

      return parsed;
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveDefaultAddress(): Promise<string> {
  const payload = unwrapData<{ evmAddress?: string }>(
    await runJsonCommand(["wallet", "balance"])
  );

  if (!payload.evmAddress) {
    throw new Error("Could not resolve a default EVM address from the active Agentic Wallet session.");
  }

  return payload.evmAddress;
}

export async function fetchApprovals(params: {
  address: string;
  chain?: string;
}): Promise<ApprovalRecord[]> {
  const args = ["security", "approvals", "--address", params.address];
  if (params.chain) {
    args.push("--chain", normalizeChain(params.chain));
  }

  const payload = unwrapData<{
    approvalList?: unknown[];
    dataList?: unknown[];
  } | Array<{
    approvalList?: unknown[];
    dataList?: unknown[];
  }>>(await runJsonCommand(args));

  const pages = Array.isArray(payload) ? payload : [payload];
  const approvalList = pages.flatMap((page) => {
    if (Array.isArray(page.approvalList)) {
      return page.approvalList;
    }
    if (Array.isArray(page.dataList)) {
      return page.dataList;
    }
    return [];
  });

  return approvalList.map((item) => {
    const record = item as Record<string, unknown>;
    const vulnerabilityFlag = record.vulnerabilityFlag;
    const riskLevel =
      typeof record.riskLevel === "string"
        ? record.riskLevel
        : vulnerabilityFlag === true
          ? "high"
          : "low";
    const spenderAddress =
      typeof record.spenderAddress === "string" && record.spenderAddress
        ? record.spenderAddress
        : String(record.approvalAddress ?? "");
    const tokenSymbol =
      typeof record.tokenSymbol === "string" && record.tokenSymbol
        ? record.tokenSymbol
        : String(record.symbol ?? "");
    const allowance =
      typeof record.allowance === "string" && record.allowance
        ? record.allowance
        : typeof record.remainAmtPrecise === "string" && record.remainAmtPrecise
          ? record.remainAmtPrecise
          : String(record.remainAmount ?? "");
    const allowanceRaw =
      typeof record.allowance === "string" && /^\d+$/.test(record.allowance)
        ? record.allowance
        : typeof record.remainAmount === "string" && /^\d+$/.test(record.remainAmount)
          ? record.remainAmount
          : "";
    const isUnlimited = parseUnlimitedFlag(record, allowance);

    return {
      tokenSymbol,
      tokenAddress: String(record.tokenAddress ?? ""),
      chainIndex: String(record.chainIndex ?? ""),
      spenderAddress,
      allowance,
      allowanceRaw,
      isUnlimited,
      riskLevel,
      protocolLabel:
        typeof record.protocolLabel === "string" && record.protocolLabel
          ? record.protocolLabel
          : typeof record.protocolName === "string" && record.protocolName
            ? record.protocolName
            : undefined,
      raw: item
    };
  });
}

export function buildApproveCalldata(
  spenderAddress: string,
  amount: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spenderAddress as `0x${string}`, amount]
  });
}

export function buildRevokeCalldata(spenderAddress: string): `0x${string}` {
  return buildApproveCalldata(spenderAddress, 0n);
}

export async function scanTransaction(params: {
  chain: string;
  from: string;
  to: string;
  data: string;
}): Promise<ScanResult> {
  return unwrapData<ScanResult>(
    await runJsonCommand([
      "security",
      "tx-scan",
      "--chain",
      normalizeChain(params.chain),
      "--from",
      params.from,
      "--to",
      params.to,
      "--data",
      params.data
    ])
  );
}

export async function revokeApproval(params: {
  chain: string;
  tokenAddress: string;
  from?: string;
  data: string;
}): Promise<{ txHash?: string }> {
  const args = [
    "wallet",
    "contract-call",
    "--to",
    params.tokenAddress,
    "--chain",
    normalizeChain(params.chain),
    "--input-data",
    params.data
  ];

  if (params.from) {
    args.push("--from", params.from);
  }
  args.push("--force");

  return unwrapData<{ txHash?: string }>(await runJsonCommand(args));
}

async function submitContractCallWithRetry(params: {
  chain: string;
  tokenAddress: string;
  from?: string;
  data: string;
}): Promise<{ txHash?: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < CONTRACT_CALL_RETRIES; attempt += 1) {
    try {
      return await revokeApproval(params);
    } catch (error) {
      lastError = error;
      if (attempt < CONTRACT_CALL_RETRIES - 1) {
        await sleep(1200 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function executeRevokeFlow(params: {
  approvals: Array<{
    approval: ApprovalRecord;
    plannedAction: "revoke" | "replace_with_exact_approval";
    replacementAllowance?: string;
  }>;
  chain: string;
  from: string;
  apply: boolean;
}): Promise<ExecuteResult[]> {
  const results: ExecuteResult[] = [];

  for (const item of params.approvals) {
    const { approval, plannedAction, replacementAllowance } = item;
    const calldata = buildRevokeCalldata(approval.spenderAddress);
    const scan = await scanTransaction({
      chain: params.chain,
      from: params.from,
      to: approval.tokenAddress,
      data: calldata
    });

    const command = [
      "onchainos",
      "wallet",
      "contract-call",
      "--to",
      approval.tokenAddress,
      "--chain",
      normalizeChain(params.chain),
      "--input-data",
      calldata
    ];

    if (params.from) {
      command.push("--from", params.from);
    }

    const result: ExecuteResult = {
      approval,
      plannedAction,
      scan,
      command,
      followUp:
        plannedAction === "replace_with_exact_approval"
          ? replacementAllowance
            ? `Unlimited approval will be replaced with an exact allowance of ${replacementAllowance}.`
            : "Unlimited approval was cleared. Re-grant an exact approval only when the next action needs it."
          : undefined
    };

    if (params.apply && scan.action !== "block") {
      try {
        const execution = await submitContractCallWithRetry({
          chain: params.chain,
          tokenAddress: approval.tokenAddress,
          from: params.from,
          data: calldata
        });
        result.txHash = execution.txHash;
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        result.followUp = "Cleanup execution failed before the replacement step could run.";
        results.push(result);
        continue;
      }

      if (
        plannedAction === "replace_with_exact_approval" &&
        replacementAllowance &&
        /^\d+$/.test(replacementAllowance) &&
        BigInt(replacementAllowance) > 0n
      ) {
        const replacementCalldata = buildApproveCalldata(
          approval.spenderAddress,
          BigInt(replacementAllowance)
        );
        const replacementScan = await scanTransaction({
          chain: params.chain,
          from: params.from,
          to: approval.tokenAddress,
          data: replacementCalldata
        });

        const replacementCommand = [
          "onchainos",
          "wallet",
          "contract-call",
          "--to",
          approval.tokenAddress,
          "--chain",
          normalizeChain(params.chain),
          "--input-data",
          replacementCalldata
        ];

        if (params.from) {
          replacementCommand.push("--from", params.from);
        }

        result.replacementScan = replacementScan;
        result.replacementCommand = replacementCommand;

        if (replacementScan.action !== "block") {
          try {
            const replacementExecution = await submitContractCallWithRetry({
              chain: params.chain,
              tokenAddress: approval.tokenAddress,
              from: params.from,
              data: replacementCalldata
            });
            result.replacementTxHash = replacementExecution.txHash;
            result.followUp = `Unlimited approval was replaced with an exact allowance of ${replacementAllowance}.`;
          } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.followUp =
              "Unlimited approval was cleared, but the exact replacement transaction failed.";
          }
        } else {
          result.followUp =
            "Unlimited approval was cleared, but the replacement exact approval was blocked by the security scan.";
        }
      }
    }

    results.push(result);
  }

  return results;
}
