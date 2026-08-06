import { redirect } from "next/navigation";

export const metadata = { title: "Platform configuration" };

export default function DevelopmentStatusRedirect() {
  redirect("/admin/platform");
}
