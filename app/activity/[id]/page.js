import { redirect } from "next/navigation";
export const metadata = { title: "Spotly Activity", description: "Track this Spotly activity." };
export default async function ActivityDetailPage({ params }) {
  const { id } = await params;
  redirect(`/?view=activity&order=${encodeURIComponent(id)}`);
}
