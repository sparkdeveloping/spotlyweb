import { CareerJob } from "@/components/careers-app";
import { careerOpeningById } from "@/data/careers";

export async function generateMetadata({ params }) {
  const { jobId } = await params;
  const job = careerOpeningById(jobId);
  return {
    title: job ? job.title : "Open role",
    description: job?.summary || "Explore an open role at Spotly.",
    alternates: { canonical: `https://careers.spotlyafrica.com/jobs/${jobId}` },
    robots: { index: Boolean(job), follow: true }
  };
}

export default async function CareerJobPage({ params }) { const { jobId } = await params; return <CareerJob jobId={jobId} />; }
