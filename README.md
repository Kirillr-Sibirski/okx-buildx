# OKX Approval Firewall

`OKX Approval Firewall` is an agent-native approval firewall for X Layer wallets.

It turns raw OKX OnchainOS approval primitives into a reusable operator tool that can:

- inspect ERC-20 approval exposure
- score approval health under opinionated policy presets
- enforce local spender budgets from a policy file
- replace unlimited approvals with exact allowances
- emit markdown and JSON artifacts for auditability
- log every live remediation run to a local audit trail

Built for the `OKX Build X Hackathon`, `OKX Approval Firewall` focuses on a real agent pain point: permissions tend to accumulate after execution, but autonomous systems still need safe ways to keep operating.

## Description

OKX Approval Firewall is a CLI and reusable skill for agent operators on X Layer.

It helps agents and humans answer four practical questions:

1. What approvals are active right now?
2. Which ones are unsafe, oversized, or out of policy?
3. How should those approvals be reduced or revoked?
4. Can we remediate them live and keep a clean audit trail?

## Why it matters

Most agents can trade, but very few can manage their permissions safely.

OKX Approval Firewall is built for the missing agent-ops layer:

- unlimited approvals should not linger after execution
- trusted spenders still need spend budgets
- risky or blocked spenders should be removed automatically
- every cleanup should leave behind an artifact a human can review

This is the core thesis for the OKX Build X Hackathon submission: `agents need a permission firewall, not just a revoke button`.

## Architecture Overview

OKX Approval Firewall is intentionally simple and operator-first:

- `OnchainOS security approvals` inventories current ERC-20 approval state
- `OnchainOS security tx-scan` checks remediation transactions before execution
- `Agentic Wallet` provides the execution context and signing path
- local `policy-as-code` files define trusted, watchlisted, and blocked spenders
- local audit artifacts preserve execution results for human review

The main execution loop is:

1. fetch approvals
2. classify approvals under a policy preset and optional local config
3. generate a health summary, plan, and report
4. execute cleanup or exact-allowance replacement on X Layer
5. write a machine-readable audit artifact

## X Layer Identity

- Primary Agentic Wallet:
  `0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8`
- Target chain:
  `X Layer`
- Custom deployed contracts:
  `None in this version`

This version is intentionally focused on the agent permission layer rather than a custom smart-contract protocol.

## Product Surface

The CLI now includes:

- `status`: one-screen wallet health summary and next action
- `inspect`: raw approval inventory for a wallet
- `plan`: policy-driven decisions for each approval
- `report`: markdown or JSON submission artifact
- `execute`: live cleanup and exact-allowance remediation
- `audit`: local execution history with artifact and tx references

## Live-Proven Flows

The current build has been tested live on X Layer with an Agentic Wallet.

Proven transactions:

- setup unlimited approval: `0x23423ae4622271d62070c356305e06b803d62cb486aca426ff0aa2b399b69481`
- revoke unlimited approval: `0x1e02d66dd26b2a85305e91771cd261e314e80c5407c507a745d91fbcba586d33`
- cleanup leg of exact remediation: `0x4d32af6447c64bb6fc8cda31a2779a6f3912a7450401e7ff17c9281c18968fb4`
- exact regrant leg of exact remediation: `0x8e675c89d98ecf38ebe5525514c60d513d4cd173f569652b85919326c7d445cf`

The successful exact-remediation run wrote a local audit artifact to:

- `.okx-approval-firewall/runs/2026-04-12T16-47-55-954Z-execute.json`

## Requirements

- Node.js 22+
- `onchainos` CLI installed and authenticated
- Agentic Wallet access for live execution

## Quickstart

```bash
npm install
npm run build
```

Use the sample policy file as a starting point:

```bash
cp okx-approval-firewall.policy.example.json okx-approval-firewall.policy.json
```

Check wallet health:

```bash
npm run dev -- status --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json
```

Inspect approvals:

```bash
npm run dev -- inspect --address 0xYourWallet --chain xlayer
```

Generate a policy plan:

```bash
npm run dev -- plan --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json
```

Write a markdown report artifact:

```bash
npm run dev -- report --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json --output .okx-approval-firewall/report.md
```

Preview live cleanup:

```bash
npm run dev -- execute --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json
```

Apply live cleanup and exact remediation:

```bash
npm run dev -- execute --address 0xYourWallet --policy strict --config okx-approval-firewall.policy.json --apply
```

Review recent live runs:

```bash
npm run dev -- audit
```

## Policy-As-Code

OKX Approval Firewall supports a local JSON policy file for spender-specific rules.

Example:

```json
{
  "defaults": {
    "chain": "xlayer",
    "policy": "strict"
  },
  "spenders": {
    "0x8b773d83bc66be128c60e07e17c8901f7a64f000": {
      "label": "Execution Router",
      "trust": "trusted",
      "maxAllowance": "500000",
      "exactAllowance": "250000",
      "notes": [
        "Cap router spend to the smallest amount that still lets the agent execute."
      ]
    }
  }
}
```

Supported spender controls:

- `trust: trusted` for approved operators with a spend budget
- `trust: watchlist` for spenders that should stay visible in reviews
- `trust: blocked` for immediate revocation
- `maxAllowance` for budget enforcement
- `exactAllowance` for exact regrant after cleanup
- `notes` for operator context in plan and report output

## Docs

The repo is intentionally small:

- `README.md`: product overview, setup, and demo story
- `skills/okx-approval-firewall/SKILL.md`: reusable skill wrapper
- `okx-approval-firewall.policy.example.json`: starter policy config
- `src/`: CLI commands, policy engine, OKX integration, and audit logging

Key entrypoints:

- `src/cli.ts`
- `src/lib/okx.ts`
- `src/lib/policy.ts`
- `src/lib/audit.ts`

## Demo Story

The strongest live demo is:

1. Run `status` to show the wallet health summary.
2. Run `plan` to show a local policy catching an unlimited approval.
3. Run `report --output ...` to create a polished artifact.
4. Run `execute --apply` to revoke the unlimited approval and regrant an exact budget.
5. Run `audit` to show the recorded cleanup and tx hashes.

## Notes

- The tool currently targets ERC-20 approvals first.
- Permit2 awareness is intentionally lightweight in this milestone.
- Approval budget values are expected in raw token units for now.
- Live execution uses `tx-scan` before contract calls and records the resulting artifact locally.

## Team

- Kirill Sibirski

If you want, replace this section with your preferred public identity, role, and contact link before submission.
