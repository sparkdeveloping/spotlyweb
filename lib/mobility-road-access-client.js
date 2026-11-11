// Present exactly the access points returned by the verified route service.
// These are suggested roadside handoffs, never a claim of legal parking.
const valid = p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&
  Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180&&
  Number.isFinite(Number(p.distanceMeters))&&p.distanceMeters>=0&&p.distanceMeters<=350;

export function hasVerifiedRoadAccess(points){
  return Boolean(valid(points?.pickup)&&valid(points?.destination));
}
export function needsRoadAccessAcknowledgement(points){
  return hasVerifiedRoadAccess(points)&&
    (points.pickup.requiresConfirmation===true||points.destination.requiresConfirmation===true);
}
export function roadAccessConsent(points,acknowledged){
  if(!needsRoadAccessAcknowledgement(points)||!acknowledged)return undefined;
  return {acknowledged:true,
    pickup:{lat:points.pickup.lat,lng:points.pickup.lng},
    destination:{lat:points.destination.lat,lng:points.destination.lng}};
}
