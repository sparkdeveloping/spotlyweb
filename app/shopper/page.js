import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
export const metadata={
 title:"SpotlyShopper",description:"Stores, products, groceries and personal shopping on Spotly.",
 alternates:{canonical:"/shopper"},
 openGraph:{title:"SpotlyShopper | Spotly",description:"Stores, products, groceries and personal shopping on Spotly.",url:"/shopper"}
};
export default function SpotlyShopperPage(){
 return <Suspense fallback={<CustomerPageSkeleton/>}><MarketplaceApp basePath="/shopper" initialService="shop"/></Suspense>;
}
