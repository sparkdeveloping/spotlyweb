import { LoginApp } from "@/components/login-app";

export const metadata = { title: "Sign in", description: "Sign in to the Spotly customer, business, staff, driver, or admin workspace." };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <LoginApp initialPortal={params?.portal || "customer"} />;
}
