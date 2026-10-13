import { redirect } from "next/navigation";
export const metadata = { title: "Offering on Spotly", description: "Open this product, service, listing or ticket on Spotly." };
export default async function ItemPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const business = query?.business ? String(query.business) : "";
  if (!business) redirect("/?view=search");
  redirect(`/?business=${encodeURIComponent(business)}&offer=${encodeURIComponent(id)}`);
}
