import { redirect } from "next/navigation";

export const metadata = {
  title: "Eat",
  description: "Open Spotly Eat."
};

export default function ServicePage() {
  redirect("/?service=eat");
}
