#!/usr/bin/env node
/** Explicit independent reviewer command. Private key stays on reviewer's host.
 * No key generation, network, Firebase mutation or production release action.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rehearsalSignatureMessage } from './wave-e-release-gate.mjs';
const getArg = flag => { const index = process.argv.indexOf(flag); return index < 0 ? null : process.argv[index + 1]; };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const receiptFile=getArg('--receipt'), keyFile=getArg('--key-file'), output=getArg('--output');
    if (!receiptFile || !keyFile || !output || resolve(receiptFile) === resolve(output) || existsSync(output)) throw Error('Explicit receipt, secure key file and new output are required');
    const receipt=JSON.parse(readFileSync(receiptFile,'utf8'));
    const privateKey=createPrivateKey(readFileSync(keyFile));
    if (privateKey.asymmetricKeyType !== 'ed25519') throw Error('Only Ed25519 reviewer keys are supported');
    if (receipt.signature) throw Error('Refusing to overwrite a signed receipt');
    const signed={...receipt,signature:sign(null,rehearsalSignatureMessage(receipt),privateKey).toString('base64')};
    writeFileSync(output,JSON.stringify(signed,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('Signed rehearsal receipt written with restrictive file permissions. No launch approval implied.');
  } catch(e) { console.error('BLOCKED: receipt signing failed (missing inputs, invalid Ed25519 key or existing output)');process.exitCode=2; }
}
