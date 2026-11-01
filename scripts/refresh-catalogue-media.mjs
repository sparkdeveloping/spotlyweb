// Rebuild item assets from the reviewed source manifest. Existing files are
// retained unless --replace is supplied; no category images are substituted.
import sources from "../data/spotly-item-photo-sources.js";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
const root = fileURLToPath(new URL("../public/",import.meta.url));
const localManifest = process.argv.find(value=>value.endsWith("catalogue-photo-downloads.json"));
const entries = localManifest ? JSON.parse(await readFile(localManifest,"utf8")) : sources;
const failures = [], complete = [];
let cursor = 0;
await mkdir(path.join(root,"marketplace/items"),{recursive:true});
async function worker() {
  while(cursor<entries.length) {
    const entry=entries[cursor++], target=path.join(root,entry.path);
    try {
      if(!process.argv.includes("--replace")){try{await access(target);complete.push(entry.path);continue;}catch{}}
      let bytes;
      if(entry.localPath) bytes=await readFile(entry.localPath);
      else {
        const response=await fetch(entry.url,{signal:AbortSignal.timeout(25000),headers:{"User-Agent":"Spotly catalogue reference images/1.0"}});
        if(!response.ok || !response.headers.get("content-type")?.startsWith("image/"))throw new Error(`Source returned ${response.status}`);
        bytes=Buffer.from(await response.arrayBuffer());
      }
      if(bytes.length>10*1024*1024)throw new Error("Source exceeds image budget");
      const meta=await sharp(bytes).metadata();
      if(Math.min(meta.width,meta.height)<180)throw new Error(`Source too small: ${meta.width}x${meta.height}`);
      let processing=sharp(bytes).rotate();
      if(entry.id.startsWith("menu_kfc_")) processing=processing.trim({background:"#ffffff",threshold:8});
      const image=await processing.resize({width:512,height:512,fit:"inside",withoutEnlargement:true}).webp({quality:84,effort:5}).toBuffer();
      const actual=await sharp(image).metadata();
      if(Math.max(actual.width,actual.height)<180)throw new Error("Actual item pixels are too small after removing the blank image border");
      await writeFile(target,image);complete.push(entry.path);
    }catch(error){failures.push({id:entry.id,url:entry.url,error:error.message});}
  }
}
await Promise.all(Array.from({length:6},worker));
console.log(JSON.stringify({complete:complete.length,failures},null,2));
