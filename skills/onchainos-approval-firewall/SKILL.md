---
name: onchainos-approval-firewall
description: >
  Use this skill to inspect, score, and remediate ERC-20 approvals for an Agentic Wallet.
  Triggers: approval guard, allowance guard, approval firewall, spender budget, revoke approvals,
  exact approval replacement, stale approvals, risky spenders, approval audit.
---

# onchainos-approval-firewall

onchainos-approval-firewall is a reusable operator skill for X Layer agents.

It is designed for agents that need to:

- start with a guided approval-health check
- run the firewall from a lightweight local dashboard
- inspect approval health through natural-language requests
- run a one-command approval review with top findings, tx-scan preflight, and the safest next step
- review approval exposure before and after execution
- apply local spender policy and budget rules
- replace unlimited approvals with exact allowances
- export human-readable reports and machine-readable artifacts
- keep an audit trail of live cleanup runs

In normal operation, the core loop is:

- `review`
- `execute --apply`
- `audit`

## Command Surface

```bash
npm run dev -- doctor
npm run dev -- dashboard
npm run dev -- assist --input "Check my wallet health on X Layer"
npm run dev -- assist --input "Clean up risky approvals but keep trading routers active" --config onchainos-approval-firewall.policy.json
npm run dev -- review
npm run dev -- status --address 0xYourWallet --policy strict --config onchainos-approval-firewall.policy.json
npm run dev -- inspect --address 0xYourWallet --chain xlayer
npm run dev -- plan --address 0xYourWallet --policy strict --config onchainos-approval-firewall.policy.json
npm run dev -- report --address 0xYourWallet --policy strict --config onchainos-approval-firewall.policy.json --output .onchainos-approval-firewall/report.md
npm run dev -- execute --address 0xYourWallet --policy strict --config onchainos-approval-firewall.policy.json --apply
npm run dev -- audit
```

Minimal commands once the wallet session is active and the default config file exists:

```bash
npm run dev -- review
npm run dev -- execute --apply
npm run dev -- audit
```

## Policy Presets

- `strict`: revoke high-risk approvals and eliminate unlimited exposure
- `minimal`: keep normal activity but still revoke obviously dangerous exposure
- `trading`: preserve active workflows while shrinking oversized permissions

## Policy File

Use a local JSON file to define spender-specific rules:

- `trust: trusted | watchlist | blocked`
- `maxAllowance`
- `exactAllowance`
- `label`
- `notes`

Example starter file:

```bash
cp onchainos-approval-firewall.policy.example.json onchainos-approval-firewall.policy.json
```

What the policy file means in plain English:

- `blocked`: this spender should always be revoked
- `trusted`: this spender is allowed, but can still be capped
- `exactAllowance`: if the spender currently has an unlimited approval, replace it with this exact budget
- `maxAllowance`: if the spender has too much allowance, shrink it

## Environment Notes

For optional model-backed summaries, create a `.env` file from `.env.example` and load it before running the CLI:

```bash
cp .env.example .env
set -a
source .env
set +a
```

Supported variables:

- `APPROVAL_FIREWALL_LLM_API_KEY`
- `APPROVAL_FIREWALL_LLM_MODEL`
- `APPROVAL_FIREWALL_LLM_BASE_URL`
- or the equivalent `OPENAI_*` variables

The normal live execution path does `not` require putting a private key or mnemonic in `.env`.
This skill uses the active `Agentic Wallet` session through the real `onchainos` CLI.

## Intended Demo

1. Run `doctor` for the guided first-pass safety check.
2. Run `assist` with a natural-language safety request.
3. Run `dashboard` to inspect the same review loop in a visual operator surface.
4. Run `review` to get the highest-signal operator view and dry-run remediation preview in one command.
5. Run `status` to show the wallet health summary.
6. Run `plan` to show why the current approval state is acceptable or risky.
7. Run `report --output ...` to create a shareable artifact.
8. Run `execute --apply` to clean up or replace oversized approvals and verify the after-state.
9. Run `audit` to show the artifact path, verification delta, and resulting tx hashes.

## Current Scope

- ERC-20 approvals on EVM chains first
- OKX OnchainOS + Agentic Wallet execution flow
- natural-language request routing with safe dry-run defaults
- local audit artifacts for remediation runs
- tx-scan preflight before live remediation
- post-run verification after live remediation
- exact-allowance remediation when the policy file defines a budget

## How Another Agent Uses This Skill

Typical pattern:

1. before an onchain action on X Layer, call `review --format json`
2. if the output contains `revoke` or `replace_with_exact_approval`, call `execute --apply --format json`
3. read the tx hashes and verification output
4. continue with the original trade, payment, or routing task

So the calling agent does not guess about wallet permissions itself.
It delegates that decision to this deterministic approval firewall.
