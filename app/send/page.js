import { SendApp } from "@/components/send-app";

export const metadata = {
  title: "Send with Spotly",
  description: "Send a parcel across your city with an approved Spotly Driver, live tracking and verified pickup and delivery.",
  alternates: { canonical: "/send" }
};

export default function SendPage() { return <SendApp />; }
