export type PolicyPreset = "strict" | "minimal" | "trading";

export type PermissionAction =
  | "keep"
  | "review"
  | "revoke"
  | "replace_with_exact_approval";

export interface ApprovalRecord {
  tokenSymbol: string;
  tokenAddress: string;
  chainIndex: string;
  spenderAddress: string;
  allowance: string;
  allowanceRaw: string;
  isUnlimited: boolean;
  riskLevel: string;
  protocolLabel?: string;
  raw: unknown;
}

export interface InspectionSummary {
  totalApprovals: number;
  unlimitedApprovals: number;
  highRiskApprovals: number;
  mediumRiskApprovals: number;
  lowRiskApprovals: number;
}

export interface PolicyDecision {
  approval: ApprovalRecord;
  action: PermissionAction;
  severity: "low" | "medium" | "high";
  reason: string;
  replacementAllowance?: string;
  policyLabel?: string;
  notes?: string[];
}

export interface SpenderPolicy {
  label?: string;
  trust?: "trusted" | "watchlist" | "blocked";
  maxAllowance?: string;
  exactAllowance?: string;
  notes?: string[];
}

export interface PolicyConfig {
  defaults?: {
    chain?: string;
    policy?: PolicyPreset;
  };
  spenders?: Record<string, SpenderPolicy>;
}

export interface ScanResult {
  action?: string;
  warnings?: string[];
  riskItemDetail?: Array<{
    name?: string;
    action?: string;
    description?: Record<string, string>;
  }>;
  simulator?: {
    gasLimit?: number;
    revertReason?: string | null;
  };
}

export interface ExecuteResult {
  approval: ApprovalRecord;
  plannedAction: PermissionAction;
  scan: ScanResult;
  command: string[];
  txHash?: string;
  replacementScan?: ScanResult;
  replacementCommand?: string[];
  replacementTxHash?: string;
  followUp?: string;
  error?: string;
}

export interface ExecutionVerification {
  beforeSummary: InspectionSummary;
  afterSummary?: InspectionSummary;
  beforeActionableCount: number;
  afterActionableCount?: number;
  beforeCleanupCount: number;
  afterCleanupCount?: number;
  beforeReviewCount: number;
  afterReviewCount?: number;
  error?: string;
}

export interface AuditLogEntry {
  kind: "execute";
  timestamp: string;
  walletAddress: string;
  chain: string;
  policy: PolicyPreset;
  configPath?: string;
  artifactPath?: string;
  results: ExecuteResult[];
  verification?: ExecutionVerification;
}
