#!/usr/bin/env node
// Read-only release preflight. It never calls Firebase, changes rules, or deploys.
// Capture an authorized operator's `firebase functions:list --project spotly-africa --json`
// result and pass its file path using --inventory. Treat missing/unknown evidence as NO-GO.
import { readFileSync } from 'node:fs';

const REQUIRED = Object.freeze([
  { name: 'businessPortfolio', region: 'us-central1' },
  { name: 'businessLifecycle', region: 'us-central1' },
  { name: 'businessBranches', region: 'us-central1' },
  { name: 'businessTeam', region: 'us-central1' },
  { name: 'publicDirectory', region: 'us-central1' },
  { name: 'driverBootstrap', region: 'europe-west1' },
]);
function rowsFromInventory(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.functions)) return data.functions;
  return [];
}
function parseFunctionId(row) {
  const s = [row.id, row.entryPoint, row.name, row.functionName].find(x => typeof x === 'string' && x.trim());
  return String(s || '').split('/').pop();
}
function parseRegions(row) {
  const values = [row.region, row.location, ...(Array.isArray(row.regions) ? row.regions : [])]
    .filter(x => typeof x === 'string' && x.trim());
  // A cloud function full resource name can also contain a region; only use
  // it when the explicit region field is absent.
  if (!values.length && typeof row.name === 'string') {
    const match = row.name.match(/\/locations\/([a-z0-9-]+)\/functions\//i);
    if (match) values.push(match[1]);
  }
  return values;
}
export function auditInventory(inventory) {
  const rows = rowsFromInventory(inventory);
  return REQUIRED.map(requirement => {
    const matches = rows.filter(row => parseFunctionId(row) === requirement.name);
    if (!matches.length) return { ...requirement, status: 'missing' };
    if (matches.some(row => parseRegions(row).includes(requirement.region))) return { ...requirement, status: 'confirmed' };
    if (matches.some(row => parseRegions(row).length === 0)) return { ...requirement, status: 'region-unknown' };
    return { ...requirement, status: 'wrong-region' };
  });
}
export const requiredFunctions = REQUIRED;

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const index = process.argv.indexOf('--inventory');
  if (index === -1 || !process.argv[index + 1]) {
    process.stderr.write('NO-GO: deployed Firebase callable inventory not supplied.\n');
    process.stderr.write('Read-only evidence command for authorized operations:\n');
    process.stderr.write('firebase functions:list --project spotly-africa --json > callable-inventory.json\n');
    process.stderr.write('node scripts/business-driver-runtime-inventory.mjs --inventory callable-inventory.json\n');
    process.exitCode = 2;
  } else {
    try {
      const evidence = JSON.parse(readFileSync(process.argv[index + 1], 'utf8'));
      const results = auditInventory(evidence);
      for (const row of results) process.stdout.write(`${row.name} (${row.region}): ${row.status}\n`);
      process.stdout.write(`Release gate: ${results.every(row => row.status === 'confirmed') ? 'inventory verified (not end-to-end certified)' : 'NO-GO'}\n`);
      process.exitCode = results.every(row => row.status === 'confirmed') ? 0 : 1;
    } catch {
      process.stderr.write('NO-GO: inventory could not be read as JSON. Do not paste credentials or user records.\n');
      process.exitCode = 2;
    }
  }
}
