import { ClaimApp } from "@/components/claim-app";

export const metadata = { title: "List or claim a business", description: "Find, add, or claim a Zimbabwean business on Spotly." };

export default async function ClaimPage({ searchParams }) {
  const params = await searchParams;
  return <ClaimApp initialBusinessId={params?.business || ""} newBusiness={params?.new === "1"} initialName={params?.name || ""} initialDraftId={params?.draft || ""} />;
}
