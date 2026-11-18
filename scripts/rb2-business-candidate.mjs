#!/usr/bin/env node
/**
 * RB2 read-only canonical Business callable source reconciliation.
 * Usage: node scripts/rb2-business-candidate.mjs --web /path/web --business /path/business --out /path/candidate
 * IMPORTANT: Output is an UNVERIFIED ANALYSIS CANDIDATE, NOT A DEPLOYABLE FUNCTIONS RELEASE.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join, relative, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const sha = value => createHash('sha256').update(value).digest('hex');
const parseArgs = (list) => Object.fromEntries(list.flatMap((v,i) => v.startsWith('--') && list[i+1] ? [[v.slice(2),list[i+1]]] : []));
const imports = /\bfrom\s*(['"])([^'"\n]+)\1|\bimport\s*\(\s*(['"])([^'"\n]+)\3\s*\)|\bimport\s*(['"])([^'"\n]+)\5/g;
const externalAllowed = /^(?:node:[\w/-]+|firebase-admin(?:\/[\w/-]+)?|firebase-functions(?:\/[\w/-]+)?|zod)$/;
const slash = path => path.replaceAll('\\','/');
function importedPaths(source) {
  return [...source.matchAll(imports)].map(m => m[2] || m[4] || m[6]).filter(spec => /^[\w@./:-]+$/.test(spec));
}
function resolveLocal(base, relativeFile, spec) {
  const start = spec.startsWith('@/') ? spec.slice(2) : slash(join(dirname(relativeFile),spec));
  for (const option of [start, start+'.js',start+'.mjs',start+'.json',join(start,'index.js')]) {
    const abs = resolve(base,option);
    if (!abs.startsWith(base+sep) || !existsSync(abs)) continue;
    return slash(relative(base,abs));
  }
  throw new Error(`${relativeFile}: missing local dependency ${spec}`);
}
function transformSource(original, base, rel) {
  let code = original.replace(/^\s*import\s*['"]server-only['"]\s*;?\s*$/gm, '');
  code = code.replace(imports, (match, q1,p1,q2,p2,q3,p3) => {
    const spec = p1 || p2 || p3;
    if (!spec?.startsWith('.') && !spec?.startsWith('@/')) return match;
    const target = resolveLocal(base,rel,spec);
    let newPath = slash(relative(dirname(rel),target));
    if (!newPath.startsWith('.')) newPath = './'+newPath;
    return match.replace(spec,newPath);
  });
  return code;
}
export function buildBusinessCandidate({webRoot,businessRoot,outRoot,write=true}) {
  const web = resolve(webRoot); const business = resolve(businessRoot); const output = resolve(outRoot);
  if (output === web || output.startsWith(web+sep) || output === business || output.startsWith(business+sep)) throw new Error('Output must not overwrite source projects');
  const backend = join(business,'Backend','functions');
  const recorded = JSON.parse(readFileSync(join(backend,'canonical-source.json'),'utf8')).sha256;
  const pending = Object.keys(recorded); const visited=new Set();const external=new Set();const unresolved=[];const planned=new Map();
  const useBundledIcons = 'data/business-archetypes.js';
  while(pending.length) {
    const rel = pending.pop();if(visited.has(rel))continue;
    visited.add(rel);
    let raw;
    const webSource = join(web,rel);
    if(!existsSync(webSource)) {unresolved.push(`Missing canonical source: ${rel}`);continue;}
    // The canonical file imports React-only icon components. Preserve the existing
    // audited Business server representation (string icon identifiers) instead.
    const bundledIcons = rel === useBundledIcons;
    const source = bundledIcons ? join(backend,'canonical',rel) : webSource;
    if(!existsSync(source)) {unresolved.push(`Missing server presentation mapping: ${rel}`);continue;}
    raw=readFileSync(source,'utf8');
    for(const spec of importedPaths(raw)) {
      if(spec === 'server-only')continue;
      if(spec.startsWith('.') || spec.startsWith('@/')) {
        try {pending.push(resolveLocal(web,rel,spec));}catch(e){unresolved.push(e.message);}
      } else {
        external.add(spec);
        if(!externalAllowed.test(spec)) unresolved.push(`${rel}: external import ${spec} not approved for Functions candidate`);
      }
    }
    try { planned.set(rel,{text:transformSource(raw,web,rel),webSHA256:sha(readFileSync(webSource)),source:bundledIcons?'bundled-server-presentation':'canonical-web'}); }
    catch(e){unresolved.push(e.message);}
  }
  const indexPath = join(backend,'index.js');
  const indexText = readFileSync(indexPath,'utf8');
  const exported = [...indexText.matchAll(/export\s+const\s+(\w+)\s*=/g)].map(x=>x[1]);
  const knownCallable = ['businessPortfolio','businessLifecycle','publicDirectory','businessClaimsSubmit','businessInvitationsAccept','businessInvitationsDecline','publicReviews','businessBranches','businessTeam','businessMoney','supportConversations','businessOrdersUpdate','businessLaunchReviewSubmit','businessLaunchReviewInvalidate','kioskEnroll','proposeOrderSubstitution'];
  const missingCallable = knownCallable.filter(x=>!exported.includes(x));
  if(missingCallable.length) unresolved.push('Missing callable exports: '+missingCallable.join(','));
  const mutatedPaths = Object.entries(recorded).filter(([name,digest]) => sha(readFileSync(join(web,name)))!==digest).map(([name])=>name).sort();
  const result={phase:'RB2',kind:'STATIC_REBASED_CANDIDATE_NOT_DEPLOYABLE',deployAllowed:false,canonicalFiles:Object.keys(recorded).length,canonicalDriftCount:mutatedPaths.length,canonicalDriftPaths:mutatedPaths,transitiveFiles:planned.size,extraDependencies:[...planned.keys()].filter(x=>!Object.hasOwn(recorded,x)).sort(),externalImports:[...external].sort(),callableExports:knownCallable.length,unresolved:[...new Set(unresolved)].sort(),testsNeeded:['install-pinned-dependencies','load-and-execute-each-callable','auth-and-owner-isolation','App-Check-valid-and-invalid-token','business-money-ledger-and-key','idempotency','staging-transaction-matrix'],sourceMutated:false};
  if(write) {
    if(existsSync(output))throw new Error('Candidate output exists; refuse destructive overwrite');
    mkdirSync(join(output,'canonical'),{recursive:true});
    for(const [rel,{text}] of planned){let file=join(output,'canonical',rel);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text);}
    copyFileSync(indexPath,join(output,'index.js'));
    copyFileSync(join(backend,'package.json'),join(output,'package.json'));
    copyFileSync(join(backend,'package-lock.json'),join(output,'package-lock.json'));
    writeFileSync(join(output,'RB2-NO-DEPLOY.md'),'# RB2 Business callable reconciliation candidate\n\n**DO NOT DEPLOY.** Static import rebase only. No live or emulator integration, exact dependency installation, binary build, signed App Check or financial tests were performed. It uses the current web canonical source and the pre-existing server-safe icon mapping. It is for review and staging reconciliation, not an approved release.\n');
    writeFileSync(join(output,'RB2-MANIFEST.json'),JSON.stringify(result,null,2)+'\n');
  }
  return result;
}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args=parseArgs(process.argv.slice(2));
    if(!args.web || !args.business || !args.out)throw new Error('Required: --web <root> --business <root> --out <new-output-path>');
    const result=buildBusinessCandidate({webRoot:args.web,businessRoot:args.business,outRoot:args.out});
    console.log(JSON.stringify({canonicalDrift:result.canonicalDriftCount,transitiveFiles:result.transitiveFiles,callableExports:result.callableExports,unresolved:result.unresolved,deployAllowed:false},null,2));
    if(result.unresolved.length)process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=2;}
}
