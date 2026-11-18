#!/usr/bin/env node
/** Independent evidence gate. Never changes App Check enforcement, secrets or Firebase configuration. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const CLIENTS=['web','customerIOS','driverIOS','businessIOS'];
const sha=/^[0-9a-f]{64}$/i;
export function evaluateAttestationEvidence(record, {now=Date.now(),maxAgeMs=24*60*60*1000,expectedReleaseSha256=null}={}){
 const missing=[];
 if(!record||typeof record!=='object')return {status:'BLOCKED',productionDecision:'NO_GO',missing:['independent staging evidence file']};
 if(!sha.test(String(expectedReleaseSha256||'')))missing.push('trusted expected release SHA-256');
 if(!sha.test(String(record.releaseSha256||'')))missing.push('evidence release SHA-256');
 else if(sha.test(String(expectedReleaseSha256||'')) && record.releaseSha256.toLowerCase()!==expectedReleaseSha256.toLowerCase())missing.push('evidence does not match the frozen release artifact');
 if(record.environment!=='staging')missing.push('staging environment identification');
 const t=Date.parse(record.collectedAt);
 if(!Number.isFinite(t)||t>now||now-t>maxAgeMs)missing.push('recent independently dated evidence');
 if(record.verifierRole!=='independent-qa')missing.push('independent QA verification');
 for(const client of CLIENTS){
  const check=record.clients?.[client];
  if(!check||typeof check!=='object') {missing.push(client+': no device/browser attestation results');continue;}
  if(!Number.isInteger(check.validAccepted)||check.validAccepted<1)missing.push(client+': valid signed App Check tokens accepted');
  if(!Number.isInteger(check.invalidRejected)||check.invalidRejected<1)missing.push(client+': invalid tokens rejected');
  if(!Number.isInteger(check.missingRejected)||check.missingRejected<1)missing.push(client+': missing tokens rejected');
  if(!Number.isInteger(check.authenticatedFlowSucceeded)||check.authenticatedFlowSucceeded<1)missing.push(client+': legitimate authenticated journey passed');
 }
 return {status:missing.length?'BLOCKED':'EVIDENCE_PRESENT_REQUIRES_MANUAL_REVIEW',productionDecision:'NO_GO',missing};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let result;
 try{let i=process.argv.indexOf('--evidence');let j=process.argv.indexOf('--expected-release-sha');result=evaluateAttestationEvidence(i===-1?null:JSON.parse(readFileSync(resolve(process.argv[i+1]),'utf8')), {expectedReleaseSha256:j===-1?null:process.argv[j+1]});}
 catch(e){result={status:'BLOCKED',productionDecision:'NO_GO',missing:['Cannot safely read evidence: '+e.message]};}
 console.log(JSON.stringify(result,null,2));if(result.missing.length)process.exitCode=2;
}
