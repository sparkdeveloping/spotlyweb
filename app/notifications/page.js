import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { NotificationCenter } from "@/components/notification-center";
import { Button } from "@/components/ui";

export const metadata = { title: "Notifications", description: "Your Spotly customer updates, orders, bookings, support and account activity." };

export default function NotificationsPage() {
  return <AuthGate><main className="min-h-screen bg-grouped text-ink"><header className="border-b bg-[var(--surface)]"><div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="Spotly" width={40} height={40} /><span className="text-lg font-semibold">Notifications</span></Link><Button asChild variant="outline"><Link href="/"><ArrowLeft className="h-4 w-4" />Back to Spotly</Link></Button></div></header><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><NotificationCenter workspace="customer" customerMode title="Your notifications" description="Orders, bookings, support and important account updates in one place." /></div></main></AuthGate>;
}
