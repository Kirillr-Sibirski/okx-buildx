const elements = {
  llmStatus: document.querySelector("#llm-status"),
  defaultPolicy: document.querySelector("#default-policy"),
  requestInput: document.querySelector("#request-input"),
  policyInput: document.querySelector("#policy-input"),
  chainInput: document.querySelector("#chain-input"),
  addressInput: document.querySelector("#address-input"),
  configInput: document.querySelector("#config-input"),
  withBriefInput: document.querySelector("#with-brief-input"),
  assistButton: document.querySelector("#assist-button"),
  reviewButton: document.querySelector("#review-button"),
  executeButton: document.querySelector("#execute-button"),
  executeConfirmInput: document.querySelector("#execute-confirm-input"),
  messageBanner: document.querySelector("#message-banner"),
  summaryCards: document.querySelector("#summary-cards"),
  findingsList: document.querySelector("#findings-list"),
  preflightList: document.querySelector("#preflight-list"),
  briefOutput: document.querySelector("#brief-output"),
  recommendedCommand: document.querySelector("#recommended-command"),
  copyCommandButton: document.querySelector("#copy-command-button"),
  walletLink: document.querySelector("#wallet-link"),
  executionOutput: document.querySelector("#execution-output")
};

let currentReview = null;

function readForm() {
  return {
    input: elements.requestInput.value.trim(),
    policy: elements.policyInput.value || undefined,
    chain: elements.chainInput.value.trim() || undefined,
    address: elements.addressInput.value.trim() || undefined,
    config: elements.configInput.value.trim() || undefined,
    withBrief: elements.withBriefInput.checked
  };
}

function setMessage(message, tone = "info") {
  if (!message) {
    elements.messageBanner.textContent = "";
    elements.messageBanner.classList.add("hidden");
    return;
  }

  elements.messageBanner.textContent = message;
  elements.messageBanner.classList.remove("hidden");
  elements.messageBanner.style.background =
    tone === "error" ? "rgba(180, 35, 24, 0.14)" : "rgba(201, 95, 39, 0.14)";
}

function metricCard(label, value, meta) {
  return `
    <article class="summary-card">
      <span class="meta">${label}</span>
      <strong>${value}</strong>
      <p>${meta}</p>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSummary(review) {
  const approvals = review.approvals ?? [];
  const decisions = review.decisions ?? [];
  const preflight = review.preflight ?? [];
  const unlimitedApprovals = approvals.filter((approval) => approval.isUnlimited).length;
  const highRiskApprovals = approvals.filter((approval) =>
    String(approval.riskLevel || "").toLowerCase().includes("high")
  ).length;
  const blockedPreflight = preflight.filter(
    (result) => result.scan?.action === "block" || result.replacementScan?.action === "block"
  ).length;
  const safePreflight = preflight.length - blockedPreflight;
  const riskGrade =
    decisions.some((decision) => decision.action === "revoke")
      ? "critical"
      : decisions.some((decision) => decision.action === "replace_with_exact_approval" || decision.action === "review")
        ? "attention"
        : "clean";

  elements.summaryCards.innerHTML = [
    metricCard("Risk Grade", riskGrade, "Current wallet posture"),
    metricCard("Approvals", approvals.length, "Live approvals fetched"),
    metricCard("Unlimited", unlimitedApprovals, "Approvals that exceed exact budgets"),
    metricCard("High Risk", highRiskApprovals, "Spenders already marked high risk"),
    metricCard("Preflight Safe", Math.max(safePreflight, 0), "Cleanup paths that cleared tx-scan"),
    metricCard("Preflight Blocked", blockedPreflight, "Cleanup or re-grant paths blocked"),
    metricCard("Policy", review.policy, "Resolved policy preset"),
    metricCard("Chain", review.chain || "all", "Review target")
  ].join("");
}

function renderFindings(review) {
  const actionable = (review.decisions || []).filter((decision) => decision.action !== "keep");
  if (!actionable.length) {
    elements.findingsList.innerHTML = '<div class="stack-item clean"><p>Nothing needs action right now.</p></div>';
    elements.findingsList.classList.remove("empty");
    return;
  }

  elements.findingsList.innerHTML = actionable
    .slice(0, 5)
    .map((decision) => {
      const tone =
        decision.severity === "high" ? "critical" : decision.severity === "medium" ? "attention" : "clean";
      return `
        <article class="stack-item ${tone}">
          <h3>${escapeHtml(decision.action)} · ${escapeHtml(
            decision.approval.tokenSymbol || decision.approval.tokenAddress
          )}</h3>
          <p>Spender: ${escapeHtml(decision.approval.spenderAddress)}</p>
          <p>${escapeHtml(decision.reason)}</p>
          ${
            decision.replacementAllowance
              ? `<p>Exact allowance: ${escapeHtml(decision.replacementAllowance)}</p>`
              : ""
          }
        </article>
      `;
    })
    .join("");
  elements.findingsList.classList.remove("empty");
}

function renderPreflight(review) {
  const items = review.preflight || [];
  if (!items.length) {
    elements.preflightList.innerHTML = '<div class="stack-item clean"><p>No remediation preflight was needed.</p></div>';
    elements.preflightList.classList.remove("empty");
    return;
  }

  elements.preflightList.innerHTML = items
    .slice(0, 5)
    .map((result) => {
      const tone = result.scan?.action === "block" || result.replacementScan?.action === "block" ? "critical" : "clean";
      return `
        <article class="stack-item ${tone}">
          <h3>${escapeHtml(result.plannedAction)} · ${escapeHtml(
            result.approval.tokenSymbol || result.approval.tokenAddress
          )}</h3>
          <p>Cleanup scan: ${escapeHtml(result.scan?.action || "safe")}</p>
          ${result.replacementScan ? `<p>Replacement scan: ${escapeHtml(result.replacementScan.action || "safe")}</p>` : ""}
          ${result.followUp ? `<p>${escapeHtml(result.followUp)}</p>` : ""}
        </article>
      `;
    })
    .join("");
  elements.preflightList.classList.remove("empty");
}

function renderBrief(review) {
  if (review.brief) {
    elements.briefOutput.textContent = review.brief;
    elements.briefOutput.classList.remove("empty");
    return;
  }

  if (review.briefError) {
    elements.briefOutput.textContent = `Brief unavailable: ${review.briefError}`;
    elements.briefOutput.classList.remove("empty");
    return;
  }

  elements.briefOutput.textContent = "No brief returned for this review.";
  elements.briefOutput.classList.add("empty");
}

function renderWalletLink(review) {
  if (review.walletExplorerUrl) {
    elements.walletLink.href = review.walletExplorerUrl;
    elements.walletLink.classList.remove("hidden");
  } else {
    elements.walletLink.classList.add("hidden");
  }
}

function renderRecommendedCommand(review) {
  elements.recommendedCommand.textContent = review.recommendedCommand || "No recommendation yet.";
  if (review.recommendedCommand) {
    elements.copyCommandButton.classList.remove("hidden");
  } else {
    elements.copyCommandButton.classList.add("hidden");
  }
}

function renderExecution(execution) {
  const results = execution.results || [];
  if (!results.length) {
    elements.executionOutput.innerHTML = '<div class="stack-item clean"><p>No cleanup actions were generated.</p></div>';
    elements.executionOutput.classList.remove("empty");
    return;
  }

  const verification = execution.verification;
  const verificationMarkup =
    verification && verification.afterSummary
      ? `
        <article class="stack-item clean">
          <h3>Post-run verification</h3>
          <p>Unlimited approvals: ${verification.beforeSummary.unlimitedApprovals} → ${verification.afterSummary.unlimitedApprovals}</p>
          <p>High-risk approvals: ${verification.beforeSummary.highRiskApprovals} → ${verification.afterSummary.highRiskApprovals}</p>
          <p>Cleanup actions remaining: ${verification.beforeCleanupCount} → ${verification.afterCleanupCount}</p>
        </article>
      `
      : verification?.error
        ? `
          <article class="stack-item attention">
            <h3>Verification</h3>
            <p>${escapeHtml(verification.error)}</p>
          </article>
        `
        : "";

  elements.executionOutput.innerHTML = [
    execution.artifactPath
      ? `<article class="stack-item clean"><h3>Audit artifact</h3><p>${escapeHtml(execution.artifactPath)}</p></article>`
      : "",
    verificationMarkup,
    ...results.map(
      (result) => `
        <article class="stack-item ${result.error ? "critical" : "clean"}">
          <h3>${escapeHtml(result.plannedAction)} · ${escapeHtml(
            result.approval.tokenSymbol || result.approval.tokenAddress
          )}</h3>
          <p>Spender: ${escapeHtml(result.approval.spenderAddress)}</p>
          <p>Scan action: ${escapeHtml(result.scan?.action || "safe")}</p>
          ${result.txHash ? `<p>Cleanup tx: <a class="ghost-link" href="${result.txExplorerUrl || "#"}" target="_blank" rel="noreferrer">${escapeHtml(result.txHash)}</a></p>` : ""}
          ${result.replacementTxHash ? `<p>Replacement tx: <a class="ghost-link" href="${result.replacementExplorerUrl || "#"}" target="_blank" rel="noreferrer">${escapeHtml(result.replacementTxHash)}</a></p>` : ""}
          ${result.followUp ? `<p>${escapeHtml(result.followUp)}</p>` : ""}
          ${result.error ? `<p>${escapeHtml(result.error)}</p>` : ""}
        </article>
      `
    )
  ].join("");
  elements.executionOutput.classList.remove("empty");
}

function renderReview(review, message) {
  currentReview = review;
  renderSummary(review);
  renderFindings(review);
  renderPreflight(review);
  renderBrief(review);
  renderWalletLink(review);
  renderRecommendedCommand(review);
  if (message) {
    setMessage(message);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadHealth() {
  try {
    const health = await requestJson("/api/health");
    elements.llmStatus.textContent = health.llmConfigured ? "Configured" : "Not configured";
    elements.defaultPolicy.textContent = health.defaultPolicy;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), "error");
  }
}

async function runReview() {
  const form = readForm();
  const params = new URLSearchParams();
  if (form.address) params.set("address", form.address);
  if (form.chain) params.set("chain", form.chain);
  if (form.policy) params.set("policy", form.policy);
  if (form.config) params.set("config", form.config);
  if (form.withBrief) params.set("withBrief", "1");

  try {
    setMessage("Running review...");
    const review = await requestJson(`/api/review?${params.toString()}`);
    renderReview(review, "Review complete.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), "error");
  }
}

async function runAssist() {
  const form = readForm();
  if (!form.input) {
    setMessage("Add a request first so the firewall has something to interpret.", "error");
    return;
  }

  try {
    setMessage("Interpreting request...");
    const payload = await requestJson("/api/assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    renderReview(
      payload.review,
      `Assist routed to ${payload.interpretation.intent} using ${payload.interpretation.source} interpretation.`
    );
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), "error");
  }
}

async function runExecute() {
  const form = readForm();
  try {
    setMessage("Submitting live cleanup...");
    const execution = await requestJson("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        apply: true,
        confirm: elements.executeConfirmInput.checked
      })
    });
    renderExecution(execution);
    setMessage("Execution complete.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), "error");
  }
}

elements.assistButton.addEventListener("click", runAssist);
elements.reviewButton.addEventListener("click", runReview);
elements.executeButton.addEventListener("click", runExecute);
elements.copyCommandButton.addEventListener("click", async () => {
  if (!currentReview?.recommendedCommand) {
    return;
  }

  await navigator.clipboard.writeText(currentReview.recommendedCommand);
  setMessage("Recommended command copied.");
});

loadHealth();
