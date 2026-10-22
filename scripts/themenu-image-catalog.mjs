#!/usr/bin/env node
/**
 * Source discovery for a PRIVATE editorial/rights review. Does not modify
 * Firebase, production public assets, restaurant approval or checkout.
 *
 * node scripts/themenu-image-catalog.mjs [--limit 20] [--review-copies]
 * Run with explicit network access (e.g. GitHub Actions). Output is
 * ignored/unpublished until reviewers record source and underlying rights.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {safeTheMenuUrl, theMenuRestaurantInfo} from "../lib/themenu-image-extractor.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const input=path.join(root,"data/themenu/image-candidates-2026-10-21.json");
const out=path.join(root,"artifacts/themenu-review");
const limitIndex=process.argv.indexOf("--limit");
const cap=limitIndex===-1?20:Number(process.argv[limitIndex+1]);
if(!Number.isInteger(cap)||cap<1||cap>60)throw Error("Limit must be an integer from 1 to 60.");
const reviewCopies=process.argv.includes("--review-copies");
const source=JSON.parse(await fs.readFile(input,"utf8"));
const records=[...source.listingCandidates.map(x=>({name:x.name,sourcePage:x.sourcePage})),
  ...source.detailedPages.map(x=>({name:x.restaurant,sourcePage:x.sourcePage}))];
const seen=new Set();
const targets=records.filter(x=>{
 const url=safeTheMenuUrl(x.sourcePage);if(!url||seen.has(url))return false;seen.add(url);return true;
}).slice(0,cap);

async function get(url,maxBytes=2_000_000) {
  const target=safeTheMenuUrl(url);
  if(!target)throw Error("Refused: URL not at The Menu");
  const response=await fetch(target,{redirect:"error",signal:AbortSignal.timeout(12000),
    headers:{"User-Agent":"SpotlyAfrica/1.0 (permissioned restaurant content review; contact business@spotlyafrica.com)","Accept":"text/html,image/webp,image/jpeg,image/png"}});
  if(!response.ok)throw Error(`Source HTTP ${response.status}`);
  const contentType=response.headers.get("content-type")||"";
  if(!/^(text\/html|image\/(?:jpeg|png|webp))/i.test(contentType))throw Error("Unsupported source media type");
  if(Number(response.headers.get("content-length")||0)>maxBytes)throw Error("Source exceeds size limit");
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength>maxBytes)throw Error("Source exceeds size limit");
  return {bytes,contentType};
}
const result={schemaVersion:1,generatedAt:new Date().toISOString(),origin:"https://themenu.co.zw",
  publicPublication:false,rightsReviewRequired:true,restaurants:[],failures:[]};
await fs.mkdir(out,{recursive:true});
for(const item of targets){
  try{
    const {bytes}=await get(item.sourcePage);
    const html=new TextDecoder().decode(bytes);
    const record=theMenuRestaurantInfo(html,item.sourcePage);
    if(!record)throw Error("Invalid or unsupported source page");
    result.restaurants.push(record);
    if(reviewCopies)for(const [index,img] of record.imageReferences.slice(0,6).entries()){
      try{
        const media=await get(img.imageUrl,5_000_000);
        if(!/^image\/(jpeg|png|webp)/i.test(media.contentType))throw Error("Response is not an image");
        const extension=media.contentType.toLowerCase().includes("png")?"png":media.contentType.toLowerCase().includes("webp")?"webp":"jpg";
        const basename=`${record.id}-${String(index+1).padStart(2,"0")}.${extension}`;
        await fs.writeFile(path.join(out,basename),media.bytes,{flag:"wx"});
        img.reviewCopy=basename;
      }catch(error){img.reviewDownloadError=String(error.message).slice(0,180);}
    }
  }catch(error){
    result.failures.push({name:item.name,sourcePage:item.sourcePage,error:String(error.message).slice(0,200)});
  }
  // Be respectful to the source directory; no parallel swarm.
  await new Promise(resolve=>setTimeout(resolve,800));
}
result.stats={pagesRequested:targets.length,pagesParsed:result.restaurants.length,
  imageReferences:result.restaurants.reduce((n,x)=>n+x.imageReferences.length,0),failures:result.failures.length,
  reviewCopies:result.restaurants.reduce((n,x)=>n+x.imageReferences.filter(i=>i.reviewCopy).length,0)};
const file=path.join(out,"image-catalog.json");
await fs.writeFile(file,JSON.stringify(result,null,2)+"\n");
process.stdout.write(JSON.stringify({file,stats:result.stats})+"\n");
if(result.restaurants.length===0)process.exitCode=1;
