import { AdminQueueApp } from "@/components/admin-queue-app";

export default async function AdminQueuePage({ params }) {
  const { queue } = await params;
  return <AdminQueueApp queue={queue} />;
}
