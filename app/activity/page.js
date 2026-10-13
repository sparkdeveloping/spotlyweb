import { redirect } from "next/navigation";
export const metadata = { title: "Activity", description: "Your Spotly orders, deliveries, bookings and tickets." };
export default function ActivityPage() { redirect("/?view=activity"); }
