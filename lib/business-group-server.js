import "server-only";
import { openPlaces } from "./open-marketplace-data.js";
import { businessGroupKey, groupMarketplaceBusinesses } from "./business-groups.js";
import { publicBusinessRecord } from "./marketplace-public.js";
import { isMarketplaceDiscoverable } from "./marketplace-trust.js";
import { canShowDirectoryRecord } from "./nxt-policy.js";

export async function publicBusinessGroup(db, id, source, showUnclaimed) {
  if (!showUnclaimed) return publicBusinessRecord(id, source);
  const key = businessGroupKey({...source,id});
  const seeds = openPlaces().filter(item => item.id !== id && businessGroupKey(item) === key).slice(0, 200);
  const docs = seeds.length ? await db.getAll(...seeds.map(item => db.collection("businesses").doc(item.id))) : [];
  const others = seeds.map((seed, index) => ({ id: seed.id, raw: docs[index]?.exists ? docs[index].data() : seed }))
    .filter(item => isMarketplaceDiscoverable(item.raw) && canShowDirectoryRecord(item.raw, showUnclaimed))
    .map(item => publicBusinessRecord(item.id, item.raw));
  const group = groupMarketplaceBusinesses([publicBusinessRecord(id, source), ...others])[0];
  // A deep-linked branch stays selected even when another branch represents its group.
  return { ...publicBusinessRecord(id, source), ...(group?.groupedLocations ? { groupedLocations: group.groupedLocations, locationCount: group.locationCount, branchCount: group.branchCount, displayBrand: group.name } : {}) };
}
