import { brandAsset } from "@/lib/spotly-brand-assets";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  const { name } = await params;
  const source = brandAsset(name);
  if (!source) return new Response("Not found.", {status:404});
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(source, {headers:{
    "Content-Type":"image/svg+xml; charset=utf-8",
    "X-Content-Type-Options":"nosniff",
    "Cache-Control":"public, max-age=3600, stale-while-revalidate=86400",
    "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox",
    ...(download?{"Content-Disposition":`attachment; filename="${name}"`}:{})
  }});
}
