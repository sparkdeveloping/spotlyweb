import { ClaimStatusApp } from "@/components/claim-status-app";
export const metadata = { title: "Claim status", robots: { index: false, follow: false } };
export default async function ClaimStatusPage({ params }) { const values=await params; return <ClaimStatusApp claimId={values.claimId} />; }
