#!/usr/bin/env node
/** Tool/environment check only: not a substitute for a production web or native build. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const nextPkg=join(root,'node_modules','next','package.json');
const nextPresent=existsSync(nextPkg);
const xcode=spawnSync('which',['xcodebuild'],{encoding:'utf8'}).status===0;
const jsMajor=Number(process.versions.node.split('.')[0]);
const blockers=[];
if(jsMajor!==22)blockers.push(`Node version ${process.version} does not match declared 22.x`);
if(!nextPresent)blockers.push('Pinned Next.js dependencies have not been installed using npm ci');
else if(JSON.parse(readFileSync(nextPkg,'utf8')).version!==pkg.dependencies.next)blockers.push('Installed Next.js version does not match package.json');
if(!xcode)blockers.push('xcodebuild unavailable: signed iOS builds require macOS');
const r={phase:'RB2',webPackage:pkg.name||'spotlyweb',requiredNext:pkg.dependencies.next,installedNext:nextPresent?JSON.parse(readFileSync(nextPkg,'utf8')).version:null,node:process.version,xcodebuildAvailable:xcode,buildsVerified:false,productionDecision:'NO_GO',blockers};
console.log(JSON.stringify(r,null,2));if(blockers.length)process.exitCode=2;
