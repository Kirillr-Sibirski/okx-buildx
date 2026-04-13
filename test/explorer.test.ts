import assert from "node:assert/strict";
import test from "node:test";

import { buildTxExplorerUrl, buildWalletExplorerUrl } from "../src/lib/explorer.js";

test("wallet explorer url resolves for xlayer", () => {
  assert.equal(
    buildWalletExplorerUrl("0xabc", "xlayer"),
    "https://www.okx.com/web3/explorer/xlayer/address/0xabc"
  );
});

test("tx explorer url resolves for chain id 196", () => {
  assert.equal(
    buildTxExplorerUrl("0x123", "196"),
    "https://www.okx.com/web3/explorer/xlayer/tx/0x123"
  );
});

test("explorer urls do not resolve for unsupported chains", () => {
  assert.equal(buildTxExplorerUrl("0x123", "base"), undefined);
});
