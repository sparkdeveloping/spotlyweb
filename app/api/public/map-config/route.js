import {apiError} from "@/lib/firebase-admin";
import {licensedMapStyle} from "@/lib/mobility-map-provider";
export const runtime="nodejs";
export async function GET(){
 try{
  const styleUrl=licensedMapStyle();
  return Response.json({ok:true,ready:Boolean(styleUrl),styleUrl,
   provider:"maplibre",attribution:"© OpenStreetMap contributors · map tiles subject to your licensed provider terms",
   message:styleUrl?"":"Configure a licensed map style URL in SPOTLY_MAP_STYLE_URL to enable interactive maps."},
   {headers:{"Cache-Control":"public,max-age=120"}});
 }catch(e){return apiError(e)}
}
