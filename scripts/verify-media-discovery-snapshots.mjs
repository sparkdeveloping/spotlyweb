import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const customer=process.env.SPOTLY_CUSTOMER_IOS_ROOT || process.argv[2] || '';
const files=[
  path.join(root,'contracts/spotly-media-discovery.v1.json'),
  path.join(root,'firebase/functions/src/contracts/spotly-media-discovery.v1.json'),
  customer ? path.join(customer,'Contracts/spotly-media-discovery.v1.json') : ''
].filter(Boolean);
if(files.length<3) throw new Error('Set SPOTLY_CUSTOMER_IOS_ROOT to the customer iOS repository.');
const bytes=files.map(file=>fs.readFileSync(file));
for(let i=1;i<bytes.length;i++) if(!bytes[0].equals(bytes[i])) throw new Error(`Media/discovery contract mismatch: ${files[0]} != ${files[i]}`);
const parsed=JSON.parse(bytes[0]); const sha=crypto.createHash('sha256').update(bytes[0]).digest('hex');
console.log('Spotly media/discovery contract verified across web + Functions + customer iOS.');
console.log(`version=${parsed.version}`); console.log(`sha256=${sha}`);
