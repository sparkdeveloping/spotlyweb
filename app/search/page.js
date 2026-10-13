import { redirect } from "next/navigation";
export const metadata = { title: "Search", description: "Search Spotly businesses, services, products and events." };
export default function SearchPage() { redirect("/?view=search"); }
