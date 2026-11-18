#!/usr/bin/env node
// RB1: Local/read-only CI quality gate. A green `node --test` exit code is NOT
// complete release evidence when critical tests silently skip for missing
// dependencies or intentionally private fixtures.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const FIELDS = Object.freeze(["tests", "pass", "fail", "skipped"]);
export function parseTestSummary(output) {
  const values = {};
  for (const field of FIELDS) {
    const matches = [...String(output || "").matchAll(new RegExp(`^# ${field} (\\d+)\\s*$`, "gm"))];
    if (matches.length !== 1) return null;
    values[field] = Number(matches[0][1]);
    if (!Number.isSafeInteger(values[field])) return null;
  }
  return values;
}

export function assessTestEvidence({ output = "", exitCode = null } = {}) {
  const counts = parseTestSummary(output);
  const reasons = [];
  if (!counts) reasons.push("Missing or ambiguous Node test summary");
  if (exitCode !== 0) reasons.push("Test process did not exit successfully");
  if (counts) {
    if (counts.tests < 1 || counts.pass + counts.fail + counts.skipped > counts.tests)
      reasons.push("Invalid Node test counts");
    if (counts.fail !== 0) reasons.push(`${counts.fail} test failures`);
    if (counts.skipped !== 0) reasons.push(`${counts.skipped} skipped checks need real dependencies/private CI evidence`);
    if (counts.pass !== counts.tests) reasons.push("Not every test executed and passed");
  }
  return {
    status: reasons.length ? "BLOCKED" : "TEST_EVIDENCE_COMPLETE",
    productionDecision: "NO_GO", // this gate cannot attest builds or release production
    counts,
    reasons
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const run = spawnSync(process.execPath, ["--test"], {
    cwd: resolve(fileURLToPath(import.meta.url), "../.."),
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  const result = assessTestEvidence({ output: `${run.stdout || ""}\n${run.stderr || ""}`, exitCode: run.status });
  console.log(JSON.stringify(result, null, 2));
  if (run.error) console.error(`Test runner unavailable: ${run.error.message}`);
  if (result.status !== "TEST_EVIDENCE_COMPLETE") process.exitCode = 1;
}
