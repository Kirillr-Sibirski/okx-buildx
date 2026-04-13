# OKX Approval Firewall

`OKX Approval Firewall` is the approval safety layer for agent wallets on `X Layer`.

You can think of it as `Revoke.cash for agents`, but built around `OnchainOS`, `Agentic Wallet`, policy-based approval control, preflight security checks, post-run verification, and auditability.

It helps agents and operators:

- inspect live ERC-20 approvals
- classify exposure under policy presets or local spender rules
- preview cleanup safety with `tx-scan`
- revoke or replace unlimited approvals through Agentic Wallet
- verify the post-run state and keep an audit trail

Built for the `OKX Build X Hackathon`, the project focuses on a practical gap in agent operations: agents can trade, route, and pay, but the token approvals that enable those actions often stay open after execution.

## Project Intro

This project is a CLI, local dashboard, and reusable skill for approval hygiene on X Layer.

An agent wants to trade, route, or spend tokens. That requires ERC-20 approvals. Those approvals can be too large, too old, or point at risky spenders. This project checks them, decides what should happen, and can clean them up safely.

Core entrypoints:

- `doctor`: guided first-pass safety check
- `dashboard`: visual operator surface
- `assist`: natural-language routing
- `review`: full approval review with preflight
- `execute --apply`: live remediation with post-run verification

## Project Positioning In The X Layer Ecosystem

Most X Layer agent projects focus on action execution. `OKX Approval Firewall` focuses on the permission layer around those actions.

It is designed for the X Layer ecosystem as:

- a safety wrapper around agent trading and payment flows
- a way to reduce lingering unlimited approvals
- a policy layer for trusted, watchlisted, and blocked spenders
- an auditable cleanup workflow for live agent wallets

Core thesis: `agents need a permission firewall, not just a revoke button`.

## Architecture Overview

Main workflow:

1. fetch approvals with `OnchainOS security approvals`
2. decide whether each approval should be kept, reviewed, revoked, or reduced
3. preflight remediation with `OnchainOS security tx-scan`
4. execute through `Agentic Wallet`
5. verify the after-state and write a local audit artifact

## Onchain Identity And Deployment Address

- Primary Agentic Wallet address: `0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8`
- Target chain: `X Layer`
- Chain ID: `196`
- Deployment identity for submission: the Agentic Wallet above performs live remediation
- Custom deployed contracts: `None in this version`

## OnchainOS / Uniswap Skill Usage

This project is intentionally built around `OnchainOS` and `Agentic Wallet`. It does not need Uniswap integration for the core approval-firewall use case.

OnchainOS modules used:

- `security approvals`
- `security tx-scan`
- `wallet balance`
- `wallet contract-call`

How they are used:

1. resolve the active wallet
2. inspect current approvals
3. classify each approval as `keep`, `review`, `revoke`, or `replace_with_exact_approval`
4. scan revoke or exact-approval transactions before execution
5. execute live cleanup through Agentic Wallet

## AI Interactive Experience

The product includes:

- `assist` for natural-language routing
- `doctor` for the safest guided first-run flow
- `brief` for model-backed operator summaries when an OpenAI-compatible API key is configured
- `dashboard` for a visual review and execution surface on top of the same shared workflows

Live execution still requires explicit confirmation or `--apply`.

The important point is that this is not the trading agent itself. It is the approval-control layer an agent or operator uses before and after the wallet touches funds.

## Quickstart

```bash
npm install
npm run build
cp okx-approval-firewall.policy.example.json okx-approval-firewall.policy.json
```

Recommended first commands:

```bash
npm run dev -- doctor
npm run dev -- dashboard
npm run dev -- review --with-brief
```

Live cleanup:

```bash
npm run dev -- execute --policy strict --config okx-approval-firewall.policy.json --apply
```

Model-backed briefing:

```bash
export APPROVAL_FIREWALL_LLM_API_KEY=...
export APPROVAL_FIREWALL_LLM_MODEL=gpt-4o-mini
npm run dev -- brief --policy strict --address 0xYourWallet
```

Verification:

```bash
npm run ci
```

## Live Proof

Tested live on X Layer with the project Agentic Wallet.

Verified transactions:

- setup unlimited approval: `0x23423ae4622271d62070c356305e06b803d62cb486aca426ff0aa2b399b69481`
- revoke unlimited approval: `0x1e02d66dd26b2a85305e91771cd261e314e80c5407c507a745d91fbcba586d33`
- cleanup leg of exact remediation: `0x4d32af6447c64bb6fc8cda31a2779a6f3912a7450401e7ff17c9281c18968fb4`
- exact regrant leg of exact remediation: `0x8e675c89d98ecf38ebe5525514c60d513d4cd173f569652b85919326c7d445cf`

## Team Members

Required for submission:

- `Kirill Sibirski`
- Contact: `kirill.rybkov@outlook.com`
- GitHub: `Kirillr-Sibirski`
