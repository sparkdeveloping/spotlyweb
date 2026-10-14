import { getAdminServices, apiError } from "@/lib/firebase-admin";
import { listCareerJobs, publicCareerJob } from "@/lib/careers-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId") || "";
    const jobs = (await listCareerJobs(db)).map(publicCareerJob);
    if (jobId) {
      const job = jobs.find((item) => item.id === jobId);
      if (!job) return Response.json({ ok: false, error: "This position is not currently open." }, { status: 404 });
      return Response.json({ ok: true, job }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    }
    return Response.json({ ok: true, jobs }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    return apiError(error);
  }
}
