/** Map style URL is sent to browsers; use only a domain-restricted public map-token. */
export function licensedMapStyle(value=process.env.SPOTLY_MAP_STYLE_URL){
 if(!value)return null;
 let url;
 try{url=new URL(value)}catch{return null}
 const forbidden=["tile.openstreetmap.org","demotiles.maplibre.org","localhost","127.0.0.1","::1"];
 if(url.protocol!=="https:"||url.username||url.password||forbidden.includes(url.hostname.toLowerCase()))return null;
 return url.toString();
}
