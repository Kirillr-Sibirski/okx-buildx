# onchainos-approval-firewall

[![Skills Arena](https://img.shields.io/badge/Build%20X-Skills%20Arena-black)](https://web3.okx.com/vi/xlayer/build-x-hackathon)
[![Chain](https://img.shields.io/badge/X%20Layer-196-blue)](https://www.okx.com/web3/explorer/xlayer)
[![License](https://img.shields.io/badge/license-MIT-green)](/Users/kirillrybkov/Desktop/x-layer/LICENSE)

> Revoke.cash for agents on X Layer.
> Deterministic approval control for Agentic Wallets via OnchainOS.

`onchainos-approval-firewall` is a reusable safety layer for agent wallets on `X Layer`. It inspects token approvals, applies local spender policy, revokes blocked spenders, shrinks oversized allowances to exact budgets, and verifies the result onchain.

## What It Does

- detect unsafe ERC-20 approvals
- apply local spender rules: `blocked`, `trusted`, `watchlist`, `budgeted`
- simulate cleanup with `tx-scan`
- revoke blocked spenders
- replace unlimited or oversized approvals with exact allowances
- leave a local audit trail with tx hashes and verification

Normal loop:

- `review`
- `execute --apply`
- `audit`

## How It Works

1. fetch approvals with `OnchainOS security approvals`
2. compare them against local policy
3. classify each approval as `keep`, `review`, `revoke`, or `replace_with_exact_approval`
4. preflight remediation with `OnchainOS security tx-scan`
5. execute through the active `Agentic Wallet`
6. verify the after-state and write an audit artifact

## X Layer Setup

- Agentic Wallet address: `0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8`
- Chain: `X Layer`
- Chain ID: `196`
- Signing path: `Agentic Wallet` via the real `onchainos` CLI

## OnchainOS Usage

- `security approvals`: fetch current ERC-20 approvals
- `security tx-scan`: simulate cleanup before execution
- `wallet balance`: resolve the active Agentic Wallet
- `wallet contract-call`: revoke blocked spenders and replace oversized approvals on X Layer

The core reasoning is deterministic and local. This tool is meant to be called by another agent, not to replace the agent.

## Quickstart

```bash
npm install
npm run build
cp onchainos-approval-firewall.policy.example.json onchainos-approval-firewall.policy.json
cp .env.example .env
set -a
source .env
set +a
```

Minimal usage once the Agentic Wallet session is active:

```bash
npm run dev -- review
npm run dev -- execute --apply
npm run dev -- audit
```

You usually do not need `--address`, `--chain`, `--policy`, or `--config` because the CLI falls back to the active Agentic Wallet session and the default local config file.

You do not need a private key in `.env` for the normal flow. Live execution uses the active `Agentic Wallet` session through the real `onchainos` CLI.

Verification:

```bash
npm run ci
```

## Policy File

`onchainos-approval-firewall.policy.json` defines local spender rules:

- `blocked`: always revoke
- `trusted`: allowed, but can still be budgeted
- `exactAllowance`: replace unlimited approvals with this exact amount
- `maxAllowance`: reduce oversized finite approvals
- `watchlist`: keep visible for manual review

## Agent Loop

Example:

1. an execution agent is about to trade, route, or pay on X Layer
2. before the action, it runs:

```bash
npm run dev -- review --format json
```

3. if the output contains `revoke` or `replace_with_exact_approval`, it runs:

```bash
npm run dev -- execute --apply --format json
```

4. it reads:
   - tx hashes
   - post-run verification
   - remaining actionable approvals

5. then it continues with its original task

So the agent is using:

- `OnchainOS` to inspect approvals, simulate cleanup, and submit transactions
- the `Agentic Wallet` to sign and execute on X Layer
- `onchainos-approval-firewall` as a deterministic permission-control layer around those actions

## Live Proof

Tested live on X Layer with the project Agentic Wallet.

Verified transactions:

- setup unlimited approval: `0x23423ae4622271d62070c356305e06b803d62cb486aca426ff0aa2b399b69481`
- revoke unlimited approval: `0x1e02d66dd26b2a85305e91771cd261e314e80c5407c507a745d91fbcba586d33`
- cleanup leg of exact remediation: `0x4d32af6447c64bb6fc8cda31a2779a6f3912a7450401e7ff17c9281c18968fb4`
- exact regrant leg of exact remediation: `0x8e675c89d98ecf38ebe5525514c60d513d4cd173f569652b85919326c7d445cf`
