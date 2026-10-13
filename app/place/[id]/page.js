import { redirect } from "next/navigation";
export const metadata = { title: "Business on Spotly", description: "Open this business on Spotly." };
export default async function PlacePage({ params }) {
  const { id } = await params;
  redirect(`/?business=${encodeURIComponent(id)}`);
}
