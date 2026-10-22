import { AdminOperationsGuide } from "@/components/admin-operations-guide";
import { AuthGate } from "@/components/auth-gate";
import { AdminAccess } from "@/components/admin-legacy-sections";
import { PortalShell } from "@/components/portal-shell";
export const metadata={title:"How Spotly Admin works",robots:{index:false,follow:false,noarchive:true}};
export default function Page(){return <AuthGate portal="admin" title="Sign in to Spotly Admin"><AdminAccess><PortalShell portalId="admin" activeSection="home"><AdminOperationsGuide/></PortalShell></AdminAccess></AuthGate>;}
