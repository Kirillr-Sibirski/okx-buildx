import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = "/Users/kirillrybkov/Desktop/x-layer";
const DEFAULT_ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MAX_UINT256 = ((1n << 256n) - 1n).toString();

async function createFakeOnchainos(approvals: Array<Record<string, unknown>>): Promise<{
  dir: string;
  statePath: string;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "okx-approval-firewall-"));
  const statePath = path.join(dir, "state.json");
  const scriptPath = path.join(dir, "onchainos");

  await writeFile(statePath, JSON.stringify({ approvals }, null, 2), "utf8");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require("node:fs");

const args = process.argv.slice(2);
const statePath = process.env.FAKE_ONCHAINOS_STATE;

function loadState() {
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

if (args[0] === "wallet" && args[1] === "balance") {
  console.log(JSON.stringify({ evmAddress: "${DEFAULT_ADDRESS}" }));
  process.exit(0);
}

if (args[0] === "security" && args[1] === "approvals") {
  const state = loadState();
  console.log(JSON.stringify({ approvalList: state.approvals }));
  process.exit(0);
}

if (args[0] === "security" && args[1] === "tx-scan") {
  console.log(JSON.stringify({ action: process.env.FAKE_SCAN_ACTION || "safe" }));
  process.exit(0);
}

if (args[0] === "wallet" && args[1] === "contract-call") {
  const state = loadState();
  state.approvals = [];
  saveState(state);
  console.log(JSON.stringify({ txHash: process.env.FAKE_TX_HASH || "0x1234" }));
  process.exit(0);
}

console.error("Unexpected onchainos call:", args.join(" "));
process.exit(1);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);

  return { dir, statePath };
}

async function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("node", ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8"
  });
}

function makeEnv(fake: { dir: string; statePath: string }): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${fake.dir}:${process.env.PATH ?? ""}`,
    FAKE_ONCHAINOS_STATE: fake.statePath
  };
}

function makeApproval(): Record<string, unknown> {
  return {
    tokenSymbol: "USDC",
    tokenAddress: "0x1000000000000000000000000000000000000001",
    chainIndex: "196",
    spenderAddress: "0x2000000000000000000000000000000000000002",
    allowance: MAX_UINT256,
    remainAmount: MAX_UINT256,
    riskLevel: "high"
  };
}

test("review command shows preflight remediation guidance", async () => {
  const fake = await createFakeOnchainos([makeApproval()]);

  try {
    const { stdout } = await runCli(["review", "--chain", "xlayer"], makeEnv(fake));

    assert.match(stdout, /OKX Approval Firewall Review/);
    assert.match(stdout, /Policy: strict/);
    assert.match(stdout, /Preflight remediation/);
    assert.match(stdout, /Cleanup scan: safe/);
    assert.match(stdout, /Recommended command: npm run dev -- execute --policy strict --address/);
  } finally {
    await rm(fake.dir, { recursive: true, force: true });
  }
});

test("execute command verifies the post-run state and audit replays it", async () => {
  const fake = await createFakeOnchainos([makeApproval()]);
  const artifactDir = path.join(fake.dir, "artifacts");

  try {
    const execution = await runCli(
      ["execute", "--chain", "xlayer", "--apply", "--artifact-dir", artifactDir],
      makeEnv(fake)
    );

    assert.match(execution.stdout, /Applied 1 cleanup flow/);
    assert.match(execution.stdout, /Post-run verification/);
    assert.match(execution.stdout, /Unlimited approvals: 1 -> 0 \(-1\)/);
    assert.match(execution.stdout, /Cleanup actions remaining: 1 -> 0 \(-1\)/);

    const audit = await runCli(["audit", "--artifact-dir", artifactDir], makeEnv(fake));

    assert.match(audit.stdout, /OKX Approval Firewall Audit/);
    assert.match(audit.stdout, /Post-run verification/);
    assert.match(audit.stdout, /Unlimited approvals: 1 -> 0 \(-1\)/);
  } finally {
    await rm(fake.dir, { recursive: true, force: true });
  }
});
