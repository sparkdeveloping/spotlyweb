import { apiError, getAdminServices, verifyAppCheckRequest } from '@/lib/firebase-admin';
import { enforceRateLimit } from '@/lib/rate-limit-server';
import { countryForCity, normalizeCountryCode } from '@/lib/country-engine';
import { queryDiscoveryProjection } from '@/lib/discovery-projection';
import { resolveServiceAvailability } from '@/lib/service-availability';

export const runtime = 'nodejs';
export async function GET(request) {
  try {
    await verifyAppCheckRequest(request,{required:false});
    const rate=await enforceRateLimit(request,{key:'public-discovery-v1',limit:180,windowMs:60_000});
    const url=new URL(request.url),city=String(url.searchParams.get('city')||'').trim();
    const mode=url.searchParams.get('mode')||'search',country=normalizeCountryCode(url.searchParams.get('country'))||countryForCity(city)?.country?.code||'';
    if(!country&&mode!=='business')return Response.json({ok:true,results:[],businesses:[],items:[],total:0,totalBusinesses:0,totalItems:0,requiresLocation:true},{headers:{'Cache-Control':'public, max-age=30','X-RateLimit-Remaining':String(rate.remaining)}});
    const service=String(url.searchParams.get('service')||'').trim().toLowerCase();
    const {db}=getAdminServices(); const snapshot=await db.collection('platformSettings').doc('global').get(); const settings=snapshot.exists?snapshot.data()||{}:{};
    if(service){const decision=resolveServiceAvailability(settings,{service,country,city});if(!decision.discoverable)return Response.json({ok:true,results:[],businesses:[],items:[],total:0,totalBusinesses:0,totalItems:0,country,city,service,availability:decision});}
    const data=queryDiscoveryProjection({mode,country,city,service,q:url.searchParams.get('q')||'',category:url.searchParams.get('category')||'',type:url.searchParams.get('type')||'',businessId:url.searchParams.get('businessId')||'',offset:Number(url.searchParams.get('offset')||0),limit:Number(url.searchParams.get('limit')||24)});
    return Response.json({...data,country,city},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300','X-RateLimit-Remaining':String(rate.remaining)}});
  } catch(error){return apiError(error);}
}
