---
name: okx-approval-firewall
description: >
  Use this skill to inspect, score, and remediate ERC-20 approvals for an Agentic Wallet.
  Triggers: approval guard, allowance guard, approval firewall, spender budget, revoke approvals,
  exact approval replacement, stale approvals, risky spenders, approval audit.
---

# OKX Approval Firewall

OKX Approval Firewall is a reusable operator skill for X Layer agents.

It is designed for agents that need to:

- start with a guided approval-health check
- run the firewall from a lightweight local dashboard
- inspect approval health through natural-language requests
- run a one-command approval review with top findings, tx-scan preflight, and the safest next step
- generate model-backed operator briefings from approval state
- review approval exposure before and after execution
- apply local spender policy and budget rules
- replace unlimited approvals with exact allowances
- export human-readable reports and machine-readable artifacts
- keep an audit trail of live cleanup runs

## Command Surface

```bash
npm run dev -- doctor
npm run dev -- dashboard
npm run dev -- assist --input "Check my wallet health on X Layer"
npm run dev -- assist --input "Revoke anything unsafe now" --model gpt-4o-mini
npm run dev -- review --with-brief
npm run dev -- assist --input "Clean up risky approvals but keep trading routers active" --config okx-approval-firewall.policy.json
npm run dev -- brief --policy strict --address 0xYourWallet
npm run dev -- status --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json
npm run dev -- inspect --address 0xYourWallet --chain xlayer
npm run dev -- plan --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json
npm run dev -- report --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json --output .okx-approval-firewall/report.md
npm run dev -- execute --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json --apply
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
cp okx-approval-firewall.policy.example.json okx-approval-firewall.policy.json
```

## Intended Demo

1. Run `doctor` for the guided first-pass safety check.
2. Run `assist` with a natural-language safety request.
3. Run `dashboard` to inspect the same review loop in a visual operator surface.
4. Run `review` to get the highest-signal operator view and dry-run remediation preview in one command.
5. Run `brief` to create a model-backed operator summary.
6. Run `status` to show the wallet health summary.
7. Run `plan` to show why the current approval state is acceptable or risky.
8. Run `report --output ...` to create a shareable artifact.
9. Run `execute --apply` to clean up or replace oversized approvals and verify the after-state.
10. Run `audit` to show the artifact path, verification delta, and resulting tx hashes.

## Current Scope

- ERC-20 approvals on EVM chains first
- OKX OnchainOS + Agentic Wallet execution flow
- natural-language request routing with safe dry-run defaults
- optional OpenAI-compatible model briefings for operator narratives
- local audit artifacts for remediation runs
- tx-scan preflight before live remediation
- post-run verification after live remediation
- exact-allowance remediation when the policy file defines a budget
