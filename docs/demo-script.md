# PermissionGuard Demo Script

Official OKX guidance:

- Recommended demo runtime: `1 to 3 minutes`

Recommended target for this project:

- `2 minutes 15 seconds`

This gives enough time to show:

1. the problem
2. the policy decision
3. the live remediation
4. the audit trail

## Demo Goal

Show that PermissionGuard does more than revoke approvals.

The story is:

- it detects an unlimited approval on X Layer
- applies a local spender budget
- replaces the unlimited approval with an exact allowance
- records the run as an audit artifact

## Pre-Recording Setup

Do these before you hit record:

1. Build the repo:

```bash
npm install
npm run build
```

2. Copy the live demo policy:

```bash
cp docs/demo-policy.example.json permission-guard.policy.json
```

3. Make sure this wallet is funded on X Layer:

```text
0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8
```

4. Create the live unlimited approval off-camera:

```bash
onchainos wallet contract-call \
  --to 0x779ded0c9e1022225f8e0630b35a9b54be713736 \
  --chain xlayer \
  --input-data 0x095ea7b3000000000000000000000000779ded0c9e1022225f8e0630b35a9b54be713736ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --from 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 \
  --force
```

5. Wait until the approvals API reflects the unlimited approval:

```bash
onchainos security approvals --address 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 --chain xlayer
```

You want to see:

- `remainAmount` at max uint
- `remainAmtPrecise` as a huge value

## Recording Plan

### 0:00 to 0:15

Say:

`This is PermissionGuard, an approval firewall for agent wallets on X Layer. It audits token permissions, applies local policy, and can replace unsafe unlimited approvals with exact allowances using OKX OnchainOS.`

Command:

```bash
node dist/cli.js status --address 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 --policy strict --config permission-guard.policy.json
```

What to point out:

- `Risk grade: attention`
- the next action says the approval should be reduced

### 0:15 to 0:35

Say:

`The policy file defines a trusted spender, but caps it at an exact 0.05 USDT budget instead of leaving an unlimited approval open.`

Command:

```bash
node dist/cli.js plan --address 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 --policy strict --config permission-guard.policy.json
```

What to point out:

- `REPLACE_WITH_EXACT_APPROVAL`
- `Replacement allowance: 50000`

### 0:35 to 0:55

Say:

`PermissionGuard also creates a human-readable artifact, so an operator or judge can review the wallet state and the planned action.`

Command:

```bash
node dist/cli.js report --address 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 --policy strict --config permission-guard.policy.json --output .permission-guard/demo-report.md
```

What to point out:

- executive summary
- risk grade
- next action

### 0:55 to 1:35

Say:

`Now I’ll run the live remediation. It first tx-scans the cleanup call, revokes the unlimited approval, then regrants the exact budget on X Layer, and records everything to an audit artifact.`

Command:

```bash
node dist/cli.js execute --address 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 --policy strict --config permission-guard.policy.json --apply
```

What to point out:

- cleanup tx hash
- replacement tx hash
- audit artifact path

### 1:35 to 1:55

Say:

`After remediation, the wallet is still operational, but now the spender only has the exact budget it needs.`

Command:

```bash
node dist/cli.js status --address 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8 --policy strict --config permission-guard.policy.json
```

What to point out:

- `Risk grade: clean`
- no cleanup needed

### 1:55 to 2:15

Say:

`Finally, every live run is preserved in a local audit log with artifact paths and transaction hashes. That makes PermissionGuard useful not just for agents, but for the humans who supervise them.`

Command:

```bash
node dist/cli.js audit --artifact-dir .permission-guard
```

What to point out:

- artifact path
- cleanup tx hash
- replacement tx hash

## Recording Tips

- Keep the terminal zoomed in and use one pane only.
- If the approvals API lags for a few seconds, pause the recording and resume after the state updates.
- If you want the cleanest demo, prepare the unlimited approval off-camera and begin the recording at the `status` command.
- If time gets tight, cut the spoken intro shorter but keep `status -> plan -> execute -> audit`.

## Minimal Spoken Close

`PermissionGuard gives X Layer agents a permission firewall instead of a revoke button. It detects unsafe approvals, applies policy-as-code, remediates them live onchain, and leaves behind an audit trail.`
