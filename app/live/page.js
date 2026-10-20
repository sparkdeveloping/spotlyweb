import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
export const metadata={
 title:"SpotlyLive",description:"Local events, festivals, venues and tickets on Spotly.",
 alternates:{canonical:"/live"},
 openGraph:{title:"SpotlyLive | Spotly",description:"Local events, festivals, venues and tickets on Spotly.",url:"/live"}
};
export default function SpotlyLivePage(){
 return <Suspense fallback={<CustomerPageSkeleton/>}><MarketplaceApp basePath="/live" initialService="events"/></Suspense>;
}
