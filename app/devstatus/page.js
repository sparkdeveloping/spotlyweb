import { redirect } from "next/navigation";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export const metadata = { title: "Platform configuration" };

export default function DevelopmentStatusRedirect() {
  redirect(spotlyPortalUrl("admin", "/platform"));
}
