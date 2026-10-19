import { IndependentShoppingApp } from "@/components/independent-shopping-app";

export const metadata = {
  title: "Shop for me · Spotly",
  description: "Explore independent shopping estimates and request a price check. No store partnership is implied.",
  robots: { index: false, follow: false }
};

export default function ShopForMePage() {
  return <IndependentShoppingApp />;
}
