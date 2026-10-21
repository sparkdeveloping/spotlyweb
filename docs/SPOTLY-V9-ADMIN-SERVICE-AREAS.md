# Spotly Admin Mobility — Visual service-area launch controls

## Why the former geofence textarea was inappropriate
The production Admin form exposed `ZW:harare|ZW|-17.825|31.033|35`.
That is a server implementation detail, not an appropriate administrator task.
Coverage is necessary to reject out-of-region pickups, but the management
interface must translate business decisions into validated map coordinates.

## New Ride/Send Admin workflow

1. Navigate to **Admin → Ride & Send Launch → Ride network controls**
   or **Send network controls**. Add a city name in **Enabled cities** and
   select allowed countries using checkboxes (Ride: Zimbabwe/Malawi;
   Send: Zimbabwe only).
2. Under **Choose your pickup coverage on a map**, select country and city.
   Click **Find city on map** (optional MapTiler city lookup), pan/zoom,
   click the intended operations-center location, or drag a prior marker.
3. Move the **Pickup coverage radius** slider (3–100 km). The shaded
   circle previews exactly the radial pickup boundary.
4. Click **Add city coverage** or **Update city coverage** to stage the
   zone. Existing zones are listed below and can be removed. Nothing is
   written to the database yet.
5. Click **Save Ride network** / **Save Send network** above the map.
   Server validates the allowed country, enabled city, valid coordinates
   within that country, correct canonical key, and radius. It writes the
   existing `cityGeofences` schema; previous Ride/Send geofence validation
   functions continue to work without migration or weakened checks.
6. Return to **Service Launch** to review all remaining readiness gates.
   Saving coverage never activates live Ride or Send.

## Technical/security notes
- A circle is deliberate; it is a **pickup radius**, not a surveyed
  municipal boundary or route reachability polygon. Administrators must
  choose only realistic, supported neighborhoods and verify local Driver
  coverage. Circular geometry is drawn with approximate earth-distance
  math for preview, while backend pickup checks use haversine distance.
- City lookup may require MapTiler to allow
  `https://admin.spotlyafrica.com` on the same **public browser key**
  configured in `SPOTLY_MAP_STYLE_URL`. Add that domain in your MapTiler
  API key's allowed HTTP origins. No map credential is committed to GitHub.
  The map still supports click/drag if city search is unavailable.
- Country sanity envelopes are conservative, not official national
  boundary data. No automatic approval by MapTiler search or inferred city.
- Service zones are saved only by pre-existing Admin role-authorized PATCH
  endpoints; those endpoints now validate zone semantics as well as Zod
  number ranges. Existing audit logging remains intact.
- During a draft save, changing enabled cities/countries can invalidate
  older zones. Remove or update affected zones before saving.

## Why other launch warnings persist

**Background dispatch:** `CRON_SECRET` is a server-side, high-entropy
(32+ character) secret in Vercel/Spotly's secret configuration. An actual
external scheduler must call the signed Ride and Send dispatch endpoints
on a supported cadence. Spotly proves it saw at least three successive
recent authenticated executions. Setting a boolean in Admin cannot forge
that health record.

**Ride/Send PIN encryption:** `SPOTLY_RIDE_PIN_KEY` and
`SPOTLY_SEND_PIN_KEY` must be distinct 32+ character random secrets.
They protect encrypted handoff PINs. Put them in server-side secrets; never
type them into public UI or commit them to GitHub. Safely rotating them
requires handling already active encrypted trips. Use the same server
secret consistently across deployments processing those active trips.

**Financial & field launch:** Routing/map previews and city coverage do not
certify a Driver fleet, insurance, refund processing, provider settlement or
24/7 support. Continue to leave production activation blocked until those
are actually verified.

**No change to production until this PR is explicitly approved and merged.**
