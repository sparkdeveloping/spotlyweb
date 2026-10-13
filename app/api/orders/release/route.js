export const runtime = "nodejs";
export async function POST() {
  return Response.json({ ok: false, error: "This endpoint has been retired. Use the actor-specific order action." }, { status: 410 });
}
