import { ClaimStatusApp } from "@/components/claim-status-app";

export const metadata = { title: "Business verification status · Spotly Business", robots: { index: false, follow: false } };

export default async function BusinessClaimStatusPage({ params }) {
  const values = await params;
  return <ClaimStatusApp claimId={values.claimId} businessJourney />;
}
