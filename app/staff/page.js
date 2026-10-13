import { StaffApp } from "@/components/staff-app";

export const metadata = {
  title: "Staff home",
  description: "Spotly workforce tasks, schedules, leave, learning, pay, and support."
};

export default function StaffPage() {
  return <StaffApp section="today" />;
}
