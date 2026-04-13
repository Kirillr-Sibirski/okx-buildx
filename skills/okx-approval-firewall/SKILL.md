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

- review approval exposure before and after execution
- apply local spender policy and budget rules
- replace unlimited approvals with exact allowances
- export human-readable reports and machine-readable artifacts
- keep an audit trail of live cleanup runs

## Command Surface

```bash
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

1. Run `status` to show the wallet health summary.
2. Run `plan` to show why the current approval state is acceptable or risky.
3. Run `report --output ...` to create a shareable artifact.
4. Run `execute --apply` to clean up or replace oversized approvals.
5. Run `audit` to show the artifact path and resulting tx hashes.

## Current Scope

- ERC-20 approvals on EVM chains first
- OKX OnchainOS + Agentic Wallet execution flow
- local audit artifacts for remediation runs
- exact-allowance remediation when the policy file defines a budget
