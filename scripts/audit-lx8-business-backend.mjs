#!/usr/bin/env node
/** LX8 read-only source and callable drift audit. Never deploy from this script. */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const business = resolve(web, '../../business/spotlybusiness');
const manifestPath = resolve(business, 'Backend/functions/canonical-source.json');
if (!existsSync(manifestPath)) {
  process.stderr.write('Business iOS project is missing. Run from the complete four-platform staging workspace.\n');
  process.exitCode = 2;
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')).sha256;
  const sha = (content) => createHash('sha256').update(content).digest('hex');
  const matching = [], changed = [], missing = [];
  for (const [filename, originalHash] of Object.entries(manifest)) {
    const source = resolve(web, filename);
    if (!existsSync(source)) { missing.push(filename); continue; }
    (sha(readFileSync(source)) === originalHash ? matching : changed).push(filename);
  }
  const source = readFileSync(resolve(business, 'spotlybusiness/Production/FirebaseFunctionsService.swift'), 'utf8')
     + '\n' + readFileSync(resolve(business, 'spotlybusiness/Production/ProductionBusinessMutationStore.swift'), 'utf8');
  const index = readFileSync(resolve(business, 'Backend/functions/index.js'), 'utf8');
  const nativeOperations = [...new Set([...source.matchAll(/operation:\s*"([A-Za-z0-9]+)"/g)].map((m) => m[1]))].sort();
  const bundledExports = [...new Set([...index.matchAll(/export const ([A-Za-z0-9]+)\s*=/g)].map((m) => m[1]))].sort();
  const missingCallables = nativeOperations.filter((op) => !bundledExports.includes(op));
  const output = {
    phase: 'LX8',
    result: changed.length || missing.length || missingCallables.length ? 'RECONCILIATION_REQUIRED' : 'SOURCE_MATCH_ONLY',
    tracked: Object.keys(manifest).length,
    matchingCount: matching.length,
    changedCount: changed.length,
    missingCount: missing.length,
    changed, missing,
    nativeOperations,
    bundledExports,
    missingCallables,
    warning: 'Source matching does not verify deployed Firebase Functions, authorization, or live business operations. Do not deploy the Business-bundled Functions over newer canonical Functions without integration tests.'
  };
  const target = process.argv.find((arg) => arg.startsWith('--out='));
  if (target) writeFileSync(resolve(target.slice(6)), JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  if (process.argv.includes('--strict') && output.result !== 'SOURCE_MATCH_ONLY') process.exitCode = 1;
}
