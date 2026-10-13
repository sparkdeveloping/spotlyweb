import { redirect } from "next/navigation";

export const metadata = {
  title: "Ride",
  description: "Open Spotly Ride."
};

export default function ServicePage() {
  redirect("/?service=ride");
}
