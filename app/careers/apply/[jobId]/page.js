import { CareerApply } from "@/components/careers-app";

export const metadata = { title: "Apply", robots: { index: false, follow: false } };

export default async function CareerApplyPage({ params }) { const { jobId } = await params; return <CareerApply jobId={jobId} />; }
