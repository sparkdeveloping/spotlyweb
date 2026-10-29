import { brandAssets, BRAND_COLORS } from "@/lib/spotly-brand-assets";
import { makeBrandZip } from "@/lib/spotly-brand-zip";
export const runtime = "nodejs";
const README = `SPOTLY | OFFICIAL PARTNER BRAND ASSETS
October 2026

This curated pack is for press, approved partners and collaborators.
The complete internal master production kit is not included.

Includes three official identities (Spotly, Business, Driver), six service
identities (Bite, Shopper, Book, Live, Ride, Send), and color palette.

USAGE
- Leave clear space around the symbol, at least 12% of its width.
- Do not stretch, recolor, redraw, or distort the approved artwork.
- Use Business and Driver identities only for the corresponding product.
- These horizontal SVGs are on-light versions; ensure contrast.
- Obtain written approval before implying sponsorship or endorsement.
- For print, custom formats and colorways: https://spotlyafrica.com/support

GT Walsheim Pro licensed font software is NOT included. Outlined
vector wordmarks work without installed typefaces.
`;
export async function GET() {
  const entries = Object.entries(brandAssets()).map(([name, content]) => [`Spotly_Partner_Kit/Logos/${name}`, content]);
  entries.push(["Spotly_Partner_Kit/colors.json", JSON.stringify(BRAND_COLORS, null, 2) + "\n"]);
  entries.push(["Spotly_Partner_Kit/README.txt", README]);
  const output = makeBrandZip(entries);
  return new Response(output, {headers:{
    "Content-Type":"application/zip",
    "Content-Disposition":'attachment; filename="Spotly_Partner_Brand_Kit.zip"',
    "Content-Length": String(output.length),
    "Cache-Control":"public, max-age=3600",
    "X-Content-Type-Options":"nosniff"
  }});
}
