import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AuditLogEntry } from "../types.js";

const DEFAULT_ARTIFACT_DIR = path.resolve(".onchainos-approval-firewall");

function timestampSlug(value: string): string {
  return value.replace(/[:.]/g, "-");
}

export function resolveArtifactDir(artifactDir?: string): string {
  return artifactDir ? path.resolve(artifactDir) : DEFAULT_ARTIFACT_DIR;
}

export async function writeExecutionArtifacts(params: {
  artifactDir?: string;
  entry: AuditLogEntry;
}): Promise<{ artifactDir: string; artifactPath: string; logPath: string }> {
  const artifactDir = resolveArtifactDir(params.artifactDir);
  const runsDir = path.join(artifactDir, "runs");
  const timestamp = timestampSlug(params.entry.timestamp);
  const artifactPath = path.join(runsDir, `${timestamp}-execute.json`);
  const logPath = path.join(artifactDir, "audit-log.jsonl");

  await mkdir(runsDir, { recursive: true });

  await writeFile(artifactPath, JSON.stringify(params.entry, null, 2));
  await appendFile(logPath, `${JSON.stringify({ ...params.entry, artifactPath })}\n`, "utf8");

  return { artifactDir, artifactPath, logPath };
}

export async function readAuditLog(artifactDir?: string): Promise<AuditLogEntry[]> {
  const logPath = path.join(resolveArtifactDir(artifactDir), "audit-log.jsonl");

  try {
    const raw = await readFile(logPath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditLogEntry)
      .reverse();
  } catch {
    return [];
  }
}
