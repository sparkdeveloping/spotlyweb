import { SimpleBusinessRegistrationsAdmin } from "@/components/simple-business-registrations-admin";

export const metadata = {
  title: "Business registrations · Spotly",
  description: "Review and contact submitted businesses.",
  robots: { index: false, follow: false, noarchive: true }
};

export default function PublicBusinessRegistrationsAdminPage() {
  return <SimpleBusinessRegistrationsAdmin />;
}
