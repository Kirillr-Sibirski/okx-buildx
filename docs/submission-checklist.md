# Build X Submission Checklist

Last verified: April 12, 2026

Official sources:

- Build X hackathon page: `https://web3.okx.com/ar/xlayer/build-x-hackathon`
- Live submission form: `https://docs.google.com/forms/d/e/1FAIpQLSfEjzs4ny2yH04tfDXs14Byye1KYhXv6NeytpqSKhrqTtgKqg/viewform?usp=dialog`

## Hard Facts

- Current season: April 1, 2026 23:59 UTC to April 15, 2026 23:59 UTC
- Final submission deadline: April 15, 2026 at 23:59 UTC
- Chosen track: `Skills Arena`
- Officially recommended demo runtime: `1 to 3 minutes`
- Current live Google Form requires both:
  - `Demo Video Link`
  - `X (Twitter) Post Link`

Important note:

- The FAQ says a demo video is "not mandatory", but the live Google Form marks the demo link as required.
- The FAQ/page copy around hashtags is inconsistent across locales, but the live Google Form explicitly asks for an X post tagging `@XLayerOfficial` with hashtag `#BuildX`.
- Safest move: use `#BuildX` and also include `#onchainos` in the post copy.

## Form Checklist

- [ ] `Project Name & One-Line Description`
  Draft:
  `PermissionGuard — an agent-native approval firewall for X Layer that audits token permissions, enforces spender budgets, and replaces unsafe unlimited approvals with exact allowances.`

- [ ] `Project Highlights`
  Draft points:
  `Live onchain approval remediation on X Layer`
  `Policy-as-code for trusted, watchlisted, and blocked spenders`
  `Exact-allowance replacement instead of revoke-only cleanup`
  `Audit artifacts and execution history for human review`

- [x] `Your Track`
  `Skills Arena`

- [ ] `Team Members & Contact Information`
  Need:
  `Name + role + email or Telegram handle for every core contributor`

- [x] `Agentic Wallet Address`
  `0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8`

- [x] `GitHub Repository Link`
  `https://github.com/Kirillr-Sibirski/okx-buildx`

- [ ] `OnchainOS Usage`
  Draft:
  `PermissionGuard uses OnchainOS security approvals to inventory ERC-20 permissions, tx-scan to simulate and risk-check cleanup transactions, wallet balance/status for Agentic Wallet context, and wallet contract-call on X Layer to revoke oversized approvals and regrant exact allowances.`

- [ ] `Demo Video Link`
  Need:
  `Public YouTube, Loom, Drive, or equivalent link`

- [ ] `X (Twitter) Post Link`
  Need:
  `Public post tagging @XLayerOfficial and using #BuildX`

## README Checklist

- [x] Public repo exists
- [x] Project intro exists
- [x] OnchainOS usage is described
- [x] Working mechanics are described
- [x] Live proof / tx history is described

- [ ] Add an explicit `Architecture Overview` section
- [ ] Add an explicit `Deployment Address / Onchain Identity` section
  Suggested wording:
  `No custom contracts are deployed in this version. The primary onchain identity is the Agentic Wallet: 0x5b6a6bc856fba3e3ac9fe4e9368d2aa3090990c8.`
- [ ] Add an explicit `Team Members` section
- [ ] Add an explicit `Positioning in the X Layer Ecosystem` section

## Proof Assets We Already Have

- [x] Public GitHub repository
- [x] Live Agentic Wallet on X Layer
- [x] Real approval setup / revoke / exact-regrant transaction history
- [x] Local audit artifacts under `.permission-guard/runs/`

Useful tx hashes:

- Setup unlimited approval:
  `0x23423ae4622271d62070c356305e06b803d62cb486aca426ff0aa2b399b69481`
- First live revoke:
  `0x1e02d66dd26b2a85305e91771cd261e314e80c5407c507a745d91fbcba586d33`
- Successful cleanup leg of exact remediation:
  `0x4d32af6447c64bb6fc8cda31a2779a6f3912a7450401e7ff17c9281c18968fb4`
- Successful exact regrant leg:
  `0x8e675c89d98ecf38ebe5525514c60d513d4cd173f569652b85919326c7d445cf`

## Prize Fit

- [x] Strong fit for `Skills Arena` main prizes
- [x] Strong fit for `Most Popular` if we publish the X post and drive traffic
- [ ] Not currently positioned for `Best Uniswap integration`

## Final Submission Day Checklist

- [ ] Confirm README includes all required sections
- [ ] Confirm repo is public
- [ ] Confirm demo video link is public
- [ ] Confirm X post is live and public
- [ ] Confirm Agentic Wallet address is correct in the form
- [ ] Confirm all links open without login
- [ ] Submit before April 15, 2026 23:59 UTC
