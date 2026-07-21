import { AdminApp } from "@/components/admin-app";

export const metadata = { title: "Admin dashboard", description: "Spotly platform operations, verification, finance, and risk." };
export default function AdminPage() { return <AdminApp section="dashboard" />; }
