/**
 * Read-only The Menu image discovery. Extraction does not imply photo rights,
 * branch matching, merchant approval or authorization to publish an asset.
 */
const SOURCE_HOST = "themenu.co.zw";
const LIMIT = 70;

export function safeTheMenuUrl(value, base = "https://themenu.co.zw/") {
  try {
    const url = new URL(String(value || ""), base);
    if (url.protocol !== "https:" || ![SOURCE_HOST, "www."+SOURCE_HOST].includes(url.hostname)) return null;
    if (url.username || url.password || url.port || url.pathname.includes("..")) return null;
    return url.href;
  } catch { return null; }
}

function unescapeHtml(text = "") {
  return String(text).replace(/&(?:amp|quot|apos|lt|gt|#39|nbsp);/g, x => ({
    "&amp;":"&", "&quot;":'"', "&apos;":"'", "&lt;":"<", "&gt;":">", "&#39;":"'", "&nbsp;":" "
  })[x] || x);
}
export function plainText(html = "") {
  return unescapeHtml(String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"")
    .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
}

export function theMenuImageReferences(html, pageUrl) {
  const trustedPage = safeTheMenuUrl(pageUrl);
  if (!trustedPage || !trustedPage.includes("/listings/restaurants/")) return [];
  const refs = [];
  const tags = String(html || "").match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags.slice(0, 160)) {
    const src = tag.match(/\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || "";
    const url = safeTheMenuUrl(unescapeHtml(src), trustedPage);
    if (!url || !/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url) ||
        /(?:logo|favicon|icon|avatar|tracking)[\/.\-_]/i.test(url)) continue;
    if (refs.some(image=>image.imageUrl===url)) continue;
    let kind = /(?:\bmenus?\b|\/menus\/|menu[-_])/i.test(url+" "+alt) ? "menu" : "restaurant";
    if (/\bspecials?\b|\/specials\//i.test(url+" "+alt)) kind = "special";
    refs.push({ imageUrl: url, alt: plainText(alt).slice(0,240),
      kind, sourcePage: trustedPage, rightsStatus:"pending_provenance_review",
      approvedForSpotly:false, rightsEvidence:null, locationMatchStatus:"unreviewed" });
  }
  return refs.slice(0,LIMIT);
}

export function theMenuRestaurantInfo(html, pageUrl) {
  const trustedPage = safeTheMenuUrl(pageUrl);
  if (!trustedPage || !/^https:\/\/(?:www\.)?themenu\.co\.zw\/listings\/restaurants\/[a-z0-9-]+\.html$/.test(trustedPage)) return null;
  const title = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const slug = new URL(trustedPage).pathname.split("/").pop().replace(/\.html$/,"");
  const images = theMenuImageReferences(html, trustedPage);
  const text = plainText(html);
  const matches = [...text.matchAll(/Photo:\s*(.{0,140})/g)].slice(0,3).map(m=>m[1].trim());
  return {
    id: slug, name: title || slug.replace(/-/g," "),
    sourcePage:trustedPage, discoveredAt: new Date().toISOString(),
    imageReferences: images, sourcePhotoCredits:matches,
    imageRightsState:"review_required", importedPhotoCount:0, publishedPhotoCount:0
  };
}

export function approvedImageImport(record) {
  if (record?.rightsStatus !== "licensed" || record?.approvedForSpotly !== true ||
    record?.locationMatchStatus !== "verified" ||
    typeof record?.rightsEvidence !== "string" || record.rightsEvidence.trim().length < 8 ||
    !safeTheMenuUrl(record.imageUrl) || !safeTheMenuUrl(record.sourcePage)) return null;
  return {imageUrl: record.imageUrl, sourcePage:record.sourcePage, rightsEvidence:record.rightsEvidence.trim()};
}
