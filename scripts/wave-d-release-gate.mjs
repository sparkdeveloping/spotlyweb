#!/usr/bin/env node
/** Wave D U12–U14: source-independent, file-hash evidence review on top of LX12.
 * Strictly OFFLINE. No network, secrets, Firebase writes, deployment or launch.
 * A 'READY_FOR_MANUAL_REVIEW' result is NEVER authorization to ship.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateLX12Release } from "./lx12-launch-gate.mjs";
import contract from "../contracts/spotly-wave-d-release.v1.json" with { type: "json" };

const sha = /^sha256:[a-f0-9]{64}$/i;
const name = /^[a-z0-9_-]{3,100}$/i;
const HERE = dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
export const WAVE_D_GATES = Object.freeze(contract.gates.map(([id]) => `wave_d.${id}`));

function checkedEvidenceFile(directory, artifact) {
  const filename = artifact?.path;
  if (typeof filename !== "string" || !filename || isAbsolute(filename) || filename.includes("\\") || !sha.test(String(artifact?.sha256 || ""))) return false;
  if (!existsSync(directory)) return false;
  const root = realpathSync(directory);
  const candidate = resolve(root, filename);
  const fragment = relative(root, candidate);
  if (!fragment || fragment === ".." || fragment.startsWith(".." + sep) || isAbsolute(fragment) || !existsSync(candidate)) return false;
  const file = realpathSync(candidate);
  const realFragment = relative(root, file);
  if (realFragment === ".." || realFragment.startsWith(".." + sep) || isAbsolute(realFragment)) return false;
  const stat = statSync(file);
  if (!stat.isFile() || stat.size === 0 || stat.size > 10_000_000) return false;
  return "sha256:" + createHash("sha256").update(readFileSync(file)).digest("hex") === artifact.sha256.toLowerCase();
}

function checkRecord(record, candidate, directory, now) {
  if (!record || record.status !== "passed" || record.environment !== "staging" || record.buildDigest !== candidate?.buildDigest) return false;
  if (!name.test(String(record.operator || "")) || !name.test(String(record.reviewer || "")) || record.operator === record.reviewer) return false;
  const when = Date.parse(record.testedAt || "");
  const freeze = Date.parse(candidate?.frozenAt || "");
  if (!Number.isFinite(when) || !Number.isFinite(freeze) || when < freeze || when > now || now - when > 7 * DAY) return false;
  return checkedEvidenceFile(directory, record.artifact);
}

export function evaluateWaveDRelease(report, { directory = ".", now = Date.now() } = {}) {
  // LX12 rejects extra evidence IDs; pass its own records independently.
  const lx12Report = report && typeof report === "object" ? { ...report, evidence: report.evidence } : null;
  const lx12 = evaluateLX12Release(lx12Report, { directory, now });
  const blockers = [...lx12.blockers.map(item => ({ id: `lx12.${item.id}`, reason: item.reason }))];
  const additional = Array.isArray(report?.waveDEvidence) ? report.waveDEvidence : [];
  const records = new Map();
  const required = new Set(WAVE_D_GATES);
  for (const record of additional) {
    const id = String(record?.id || "");
    if (!required.has(id)) { blockers.push({ id: `wave_d.unexpected`, reason: "Unrecognized Wave D evidence identifier" }); continue; }
    if (records.has(id)) { blockers.push({ id, reason: "Duplicate evidence identifier" }); continue; }
    records.set(id, record);
  }
  let verified = 0;
  for (const id of WAVE_D_GATES) {
    const record = records.get(id);
    if (!record) { blockers.push({ id, reason: "Independent release evidence missing" }); continue; }
    if (!checkRecord(record, report?.candidate, directory, now)) { blockers.push({ id, reason: "Evidence is stale, unreviewed, not tied to frozen source, or checksum/path is invalid" }); continue; }
    verified++;
  }
  // This gate only checks evidence metadata and file hashes, not the truth of reports.
  // A signed release candidate still requires a separate authorized human decision.
  const ready = blockers.length === 0;
  return {
    wave: "D", releaseDecision: "NO_GO",
    assessment: ready ? "READY_FOR_MANUAL_REVIEW" : "BLOCKED",
    verifiedEvidence: lx12.verifiedEvidence + verified,
    requiredEvidence: lx12.requiredEvidence + WAVE_D_GATES.length,
    lx12Assessment: lx12.assessment,
    blockers,
    caveat: "Offline hashes and reviewer labels cannot prove device behavior, payments, legal authority, or real production state. No changes are deployed; explicit independent finance, security, legal and operations approval is mandatory."
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--report");
  const requested = index >= 0 ? process.argv[index + 1] : null;
  let result;
  try {
    const filename = requested ? resolve(requested) : null;
    const report = filename && existsSync(filename) ? JSON.parse(readFileSync(filename, "utf8")) : null;
    result = evaluateWaveDRelease(report, { directory: filename ? dirname(filename) : HERE });
  } catch {
    result = { wave: "D", releaseDecision: "NO_GO", assessment: "BLOCKED",
      verifiedEvidence: 0, requiredEvidence: WAVE_D_GATES.length,
      blockers: [{ id: "report", reason: "Evidence manifest could not be verified" }] };
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Spotly Wave D: ${result.assessment} | production ${result.releaseDecision} | ${result.verifiedEvidence}/${result.requiredEvidence} evidence items verified`);
    for (const row of result.blockers.slice(0, 100)) console.log(`BLOCK ${row.id}: ${row.reason}`);
    if (result.blockers.length > 100) console.log(`...${result.blockers.length - 100} more blockers`);
    if (result.caveat) console.log(result.caveat);
  }
  if (result.assessment !== "READY_FOR_MANUAL_REVIEW") process.exitCode = 2;
}
