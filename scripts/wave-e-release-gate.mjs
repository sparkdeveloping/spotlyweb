#!/usr/bin/env node
/** Wave E U16/U17: verifier-bound staging rehearsal receipts over Wave D evidence.
 * No deployments, Firestore reads or App Check toggles. No embedded trust anchors.
 * A successful hash/signature check is never production authorization.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateWaveDRelease } from './wave-d-release-gate.mjs';
import requirements from '../contracts/spotly-wave-e-rehearsals.v1.json' with { type: 'json' };

const DAY = 86400000;
const SHA = /^sha256:[a-f0-9]{64}$/;
const NAME = /^[a-z0-9_-]{3,100}$/;
const KEY = /^[a-z0-9_-]{3,100}$/;
export const WAVE_E_REHEARSALS = Object.freeze(requirements.rehearsals.map(row => row.id));

// The signer MUST sign exactly these fields, with these ordered JSON property keys.
// Never sign a user-provided string or a shortened hash alone.
export function rehearsalSignatureMessage(row) {
  return Buffer.from(JSON.stringify({
    schema: 'spotly.wave-e.receipt.v1',
    id: row.id,
    status: row.status,
    environment: row.environment,
    buildDigest: row.buildDigest,
    testedAt: row.testedAt,
    operator: row.operator,
    reviewer: row.reviewer,
    keyId: row.keyId,
    artifact: { path: row.artifact?.path, sha256: row.artifact?.sha256 }
  }), 'utf8');
}

function verifiedArtifact(rootDir, artifact) {
  if (!artifact || typeof artifact.path !== 'string' || !artifact.path || isAbsolute(artifact.path) || artifact.path.includes('\\') || !SHA.test(artifact.sha256 || '')) return false;
  if (!existsSync(rootDir)) return false;
  const root = realpathSync(rootDir);
  const candidate = resolve(root, artifact.path);
  const rel = relative(root, candidate);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) || !existsSync(candidate)) return false;
  // Do not accept a symlink anywhere along the path.
  let cursor = root;
  for (const part of rel.split(sep)) {
    cursor = resolve(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) return false;
  }
  const real = realpathSync(candidate);
  const r = relative(root, real);
  if (r === '..' || r.startsWith('..' + sep) || isAbsolute(r)) return false;
  const stat = statSync(candidate);
  if (!stat.isFile() || stat.size < 1 || stat.size > 10_000_000) return false;
  const actual = 'sha256:' + createHash('sha256').update(readFileSync(candidate)).digest('hex');
  return actual === artifact.sha256;
}

function reviewerKey(config, row, role) {
  if (!config || !Array.isArray(config.keys)) return null;
  const keys = config.keys.filter(key => key?.keyId === row.keyId && key?.reviewer === row.reviewer && key?.role === role);
  if (keys.length !== 1 || typeof keys[0].publicKeyPem !== 'string') return null;
  try {
    const publicKey = createPublicKey(keys[0].publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return null;
    return publicKey;
  } catch { return null; }
}

function recordValid(row, expected, candidate, directory, config, now) {
  if (!row || row.id !== expected.id || row.status !== 'passed' || row.environment !== 'staging' || row.buildDigest !== candidate?.buildDigest || !SHA.test(row.buildDigest || '')) return false;
  if (!NAME.test(row.operator || '') || !NAME.test(row.reviewer || '') || row.operator === row.reviewer || !KEY.test(row.keyId || '')) return false;
  const time = Date.parse(row.testedAt || '');
  const frozen = Date.parse(candidate?.frozenAt || '');
  if (!Number.isFinite(time) || !Number.isFinite(frozen) || time < frozen || time > now || now - time > 7 * DAY) return false;
  if (!verifiedArtifact(directory, row.artifact)) return false;
  const publicKey = reviewerKey(config, row, expected.role);
  if (!publicKey || typeof row.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(row.signature)) return false;
  try { return verify(null, rehearsalSignatureMessage(row), publicKey, Buffer.from(row.signature, 'base64')); }
  catch { return false; }
}

export function evaluateWaveERelease(report, { directory = '.', trustedKeys = null, now = Date.now() } = {}) {
  const prev = evaluateWaveDRelease(report, { directory, now });
  const blockers = prev.blockers.map(row => ({ ...row, id: `wave_d.${row.id}` }));
  if (!trustedKeys || !Array.isArray(trustedKeys.keys) || trustedKeys.keys.length === 0) blockers.push({ id: 'wave_e.trust', reason: 'Externally pinned reviewer public keys are missing' });
  if (!SHA.test(report?.candidate?.buildDigest || '') || report?.candidate?.environment !== 'staging') blockers.push({ id: 'wave_e.candidate', reason: 'Frozen staging candidate digest/environment is missing' });
  const evidence = Array.isArray(report?.waveERehearsals) ? report.waveERehearsals : [];
  const records = new Map();
  const expected = new Map(requirements.rehearsals.map(row => [row.id, row]));
  const artifacts = new Set();
  let verifiedCount = 0;
  for (const row of evidence) {
    const id = String(row?.id || '');
    if (!expected.has(id)) { blockers.push({ id: 'wave_e.unknown', reason: 'Unknown rehearsal ID' }); continue; }
    if (records.has(id)) { blockers.push({ id, reason: 'Duplicate rehearsal ID' }); continue; }
    records.set(id, row);
  }
  for (const entry of requirements.rehearsals) {
    const row = records.get(entry.id);
    if (!row) { blockers.push({ id: `wave_e.${entry.id}`, reason: 'Mandatory independently reviewed rehearsal missing' }); continue; }
    const evidenceId = row?.artifact?.path;
    if (typeof evidenceId !== 'string' || artifacts.has(evidenceId)) {
      blockers.push({ id: `wave_e.${entry.id}`, reason: 'Rehearsal artifact missing or reused across independent scenarios' });
      continue;
    }
    artifacts.add(evidenceId);
    if (!recordValid(row, entry, report.candidate, directory, trustedKeys, now)) {
      blockers.push({ id: `wave_e.${entry.id}`, reason: 'Rehearsal not bound to the frozen build, evidence file, trusted reviewer key, required role, or freshness window' });
    } else verifiedCount++;
  }
  return {
    wave: 'E', productionDecision: 'NO_GO',
    assessment: blockers.length ? 'BLOCKED' : 'READY_FOR_MANUAL_REVIEW',
    verifiedRehearsals: verifiedCount, requiredRehearsals: requirements.rehearsals.length,
    waveDAssessment: prev.assessment, blockers,
    caveat: 'Even trusted Ed25519 signatures authenticate reviewer attestations, not operational truth. TestFlight, financial settlements, regulatory approval and independent launch authorization are not inferred.'
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const getArg = flag => { const index = process.argv.indexOf(flag); return index < 0 ? null : process.argv[index + 1]; };
  let output;
  try {
    const reportPath = getArg('--report');
    const trustPath = getArg('--trusted-keys');
    if (!reportPath || !existsSync(reportPath) || !trustPath || !existsSync(trustPath)) throw new Error('missing inputs');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const trust = JSON.parse(readFileSync(trustPath, 'utf8'));
    output = evaluateWaveERelease(report, { directory: dirname(resolve(reportPath)), trustedKeys: trust });
  } catch {
    output = { wave: 'E', productionDecision: 'NO_GO', assessment: 'BLOCKED', verifiedRehearsals: 0, requiredRehearsals: requirements.rehearsals.length,
      blockers: [{ id: 'wave_e.inputs', reason: 'Trusted keys/release report absent or invalid; test evidence cannot be verified' }] };
  }
  console.log(JSON.stringify(output, null, 2));
  if (output.assessment !== 'READY_FOR_MANUAL_REVIEW') process.exitCode = 2;
}
