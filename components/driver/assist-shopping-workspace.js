"use client";
import Link from "next/link";
import {ArrowLeft,ShoppingBasket} from "lucide-react";
import {AuthGate} from "@/components/auth-gate";
import {PortalShell} from "@/components/portal-shell";
import {DriverAssistShopping} from "@/components/driver-assist-shopping";

export function AssistShoppingWorkspace(){
 return <AuthGate portal="driver" title="Driver sign in"><PortalShell portalId="driver" activeSection="jobs">
  <main className="mx-auto max-w-[980px] px-5 py-9">
   <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>Driver Work</Link>
   <div className="mt-6 flex items-start gap-4"><ShoppingBasket className="h-8 w-8 text-[var(--accent)]"/><div>
    <h1 className="text-3xl font-semibold">Independent Shop & Deliver</h1>
    <p className="mt-2 text-sm text-[var(--text-2)]">Separate customer-funded independent purchases. Accept your assigned job and verify that Operations has authorized your shopping float before spending.</p>
   </div></div>
   <DriverAssistShopping mode="jobs"/>
  </main>
 </PortalShell></AuthGate>;
}
