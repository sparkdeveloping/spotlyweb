import { redirect } from "next/navigation";

export const metadata = {
  title: "Send",
  description: "Open Spotly Send."
};

export default function ServicePage() {
  redirect("/?service=send");
}
