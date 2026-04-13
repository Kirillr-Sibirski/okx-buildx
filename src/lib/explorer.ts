export function normalizeExplorerChain(chain?: string): string | undefined {
  if (!chain) {
    return undefined;
  }

  const value = chain.trim().toLowerCase().replace(/[\s_]+/g, "");
  if (value === "xlayer" || value === "196") {
    return "xlayer";
  }
  return undefined;
}

export function buildWalletExplorerUrl(address: string, chain?: string): string | undefined {
  if (normalizeExplorerChain(chain) !== "xlayer") {
    return undefined;
  }

  return `https://www.okx.com/web3/explorer/xlayer/address/${address}`;
}

export function buildTxExplorerUrl(txHash: string, chain?: string): string | undefined {
  if (normalizeExplorerChain(chain) !== "xlayer") {
    return undefined;
  }

  return `https://www.okx.com/web3/explorer/xlayer/tx/${txHash}`;
}
