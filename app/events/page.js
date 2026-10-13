import { redirect } from "next/navigation";

export const metadata = {
  title: "Events",
  description: "Open Spotly Events."
};

export default function ServicePage() {
  redirect("/?service=events");
}
