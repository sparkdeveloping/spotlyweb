import { BUILD_INFO } from "@/lib/build-info";

export async function GET() {
  return Response.json({
    ok: true,
    status: "ok",
    service: "spotly-web-platform",
    version: BUILD_INFO.version,
    environment: BUILD_INFO.environment,
    commit: BUILD_INFO.commit === "local" ? undefined : BUILD_INFO.commit.slice(0, 12),
    timestamp: new Date().toISOString()
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
