import { redirect } from "next/navigation";
export const metadata = { title: "Saved", description: "Places and businesses you saved on Spotly." };
export default function SavedPage() { redirect("/?view=saved"); }
