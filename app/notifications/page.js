import { CustomerNotificationsPage } from "@/components/customer-notifications-page";

export const metadata = { title: "Notifications", description: "Your Spotly customer updates, orders, bookings, support and account activity." };

export default function NotificationsPage() { return <CustomerNotificationsPage customerMode />; }
