import { ClaimApp } from "@/components/claim-app";
export const metadata={title:"Verify your business · Spotly Business",robots:{index:false,follow:false}};
export default async function VerifyBusiness({searchParams}){const params=await searchParams;return <ClaimApp initialName={String(params?.name||"").slice(0,180)} initialBusinessId={params?.business||""} inviteToken={params?.invite||""} newBusiness={params?.new==="1"} initialDraftId={params?.draft||""} businessJourney/>;}
