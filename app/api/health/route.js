export async function GET() {
  return Response.json({
    ok: true,
    service: "spotly-web-platform",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
