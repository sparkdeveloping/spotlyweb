/** Only media attribution/quality fields intended for public display. */
const string = (value, limit = 2048) => typeof value === "string" ? value.slice(0, limit) : "";
const dimension = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.min(100000, Math.round(Number(value))) : null;
function position(value) {
  const match = String(value || "").match(/^(\d{1,3})% (\d{1,3})%$/);
  return match && Number(match[1]) <= 100 && Number(match[2]) <= 100 ? value : "50% 50%";
}
export function publicBusinessPhotoFields(item = {}) {
  const provenance = item.imageProvenance || {};
  const partner = item.partnerMedia || {};
  const media = item.media || {};
  return {
    image: string(item.image),
    coverImage: string(item.coverImage || item.image),
    imageUrl: string(item.imageUrl),
    photoUrl: string(item.photoUrl),
    photoFamily: string(item.photoFamily, 64),
    media: { cover: string(media.cover), hero: string(media.hero) },
    imageProvenance: {
      approved: provenance.approved === true,
      businessId: string(provenance.businessId, 200),
      rightsStatus: ["licensed", "merchant_owned"].includes(provenance.rightsStatus) ? provenance.rightsStatus : "",
      locationMatched: provenance.locationMatched === true,
      width: dimension(provenance.width), height: dimension(provenance.height), position: position(provenance.position)
    },
    partnerMedia: {
      sourceName: string(partner.sourceName, 100), usageApproved: partner.usageApproved === true,
      locationMatched: partner.locationMatched === true, sourceUrl: string(partner.sourceUrl), storedUrl: string(partner.storedUrl)
    }
  };
}
