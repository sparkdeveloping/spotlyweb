import { redirect } from "next/navigation";

export const metadata = {
  title: "Book",
  description: "Open Spotly Book."
};

export default function ServicePage() {
  redirect("/?service=book");
}
