import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
export const metadata={
 title:"SpotlyBite",description:"Restaurants, food, takeaway, pickup and delivery on Spotly.",
 alternates:{canonical:"/bite"},
 openGraph:{title:"SpotlyBite | Spotly",description:"Restaurants, food, takeaway, pickup and delivery on Spotly.",url:"/bite"}
};
export default function SpotlyBitePage(){
 return <Suspense fallback={<CustomerPageSkeleton/>}><MarketplaceApp basePath="/bite" initialService="eat"/></Suspense>;
}
