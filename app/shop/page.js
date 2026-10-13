import { redirect } from "next/navigation";

export const metadata = {
  title: "Shop",
  description: "Open Spotly Shop."
};

export default function ServicePage() {
  redirect("/?service=shop");
}
