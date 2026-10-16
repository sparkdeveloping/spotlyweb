# Spotly iOS + Web Production Parity Implementation

**Implementation date:** 16 October 2026  
**Inputs:** latest `spotly(5).zip`, current Spotly Web 7.0 source, runtime screenshots/log from the iPhone 17 Pro Max simulator  
**Goal:** move the native customer app from parity prototype to a production-oriented Spotly client while fixing the backend contracts exposed by runtime testing.

## What changed

### Native iOS

- Preserved native SwiftUI `TabView`, semantic Search role, `NavigationStack`, native back controls and system Liquid Glass chrome.
- Kept the six-service customer model: **Ride, Eat, Shop, Book, Events, Send**.
- Added/finished a native collapsing marketplace-detail hero: the hero can extend through the top safe area, then the entity name becomes the native inline navigation title after collapse. No fake navigation bar was introduced.
- Home now separates explicitly commerce-ready businesses from directory discovery instead of calling unclaimed directory listings “verified.”
- Events is event-first. Actual event/ticket items are primary; venue/directory discovery is secondary and an honest empty state is shown when no event inventory exists.
- Book separates **Book on Spotly** capability from directory-only places.
- Saved now uses the batch marketplace hydration contract, keeps a narrow 404 compatibility bridge during deployment sequencing, and excludes legacy Home/Work customer-address shortcuts from marketplace Saved.
- Activity now prefers the normalized customer Activity API and only uses a narrow 404 compatibility path while the new route is being deployed. Raw first-item junk is no longer used as ordinary order subtitle copy.
- Customer notifications filter out Business, Driver, Staff and Admin workspace records; legacy unscoped records also receive defensive domain filtering.
- Account deletion now initiates through a dedicated customer backend contract rather than a generic support message.
- Ride manual address search remains usable when GPS/current-location acquisition fails. Location failure no longer disables text search, and the focused picker hides the root tab bar.
- Send now progressively reveals Route → Parcel → Recipient → Quote/request rather than presenting one long engineering form.
- Focused transaction subflows hide the root tab bar where appropriate.
- Address display deduplicates repeated locality components and avoids repeated separators.
- Saved/Activity retain usable stale content and show compact refresh warnings instead of replacing the entire screen with raw backend errors.
- Firebase Messaging access is guarded so missing external iOS Firebase configuration does not produce unsafe initialization attempts. The real Firebase iOS App ID is still required externally.
- Removed stale bundled web output/source from the iOS repository and removed obsolete prototype screens/services no longer used by the production architecture.
- Production unit/UI test targets remain included; new regression tests cover commerce-verification semantics, Home/Work Saved separation and customer notification audience filtering.

### Spotly Web / backend companion

- Added `GET /api/customer/activity` for normalized cross-service customer Activity.
- Added `GET /api/public/marketplace/businesses` for batched Saved hydration.
- Added `POST /api/customer/account/deletion` for authenticated in-app deletion initiation with active-transaction blocker summary.
- Fixed marketplace taxonomy matching so tokens use proper boundaries (for example **bar** does not classify **barber** as Eat).
- Service-feed category chips now derive from the central marketplace taxonomy instead of leaking arbitrary raw business categories across services.
- Added nearby OSM place deduplication so node/way duplicates such as `7 Arts` collapse only when geography/address evidence shows they are the same place.
- Hardened operational notification ownership:
  - persisted records now carry explicit workspace metadata in remaining legacy direct-write paths;
  - manual push sends only to push tokens registered for the requested workspace;
  - canonical notification dispatch never falls back to tokens belonging to another Spotly product.
- Updated `.env.example` with empty server-only contract placeholders required by the existing launch tests.
- Added `scripts/audit-ios-contracts.mjs` to smoke-test required iOS production routes after deployment.
- Added iOS/native contract integrity tests.

## Runtime issues addressed from the supplied screenshots/log

- `/api/customer/activity` 404 → companion route implemented.
- `/api/public/marketplace/businesses` 404 → companion batch route implemented.
- Customer app showing Driver/Business notices → strict workspace scoping + iOS defensive filtering.
- Home/Work appearing in marketplace Saved → address/favorite domain separation.
- Events acting like a venue directory → event-first content rules and honest empty state.
- Unclaimed directory B&B Sports Bar appearing beneath “Verified places ready on Spotly” → explicit commerce-verification requirement.
- Repeated address fragments such as `Domboramwari · Domboramwari · Harare` → normalized/deduplicated address composition.
- GPS failure blocking Ride address selection → manual search is independent from current-location acquisition.
- Service hero text entering navigation chrome → reusable safe-area/content-margin treatment.
- Flat detail header → native collapsing safe-area hero with native toolbar transition.
- Large raw 404 error states with cached content → compact stale-refresh banners.

## Validation performed

### Web/backend

- `npm test`: **335 / 335 passing**.
- `npm run audit:v7-ui`: **76 checks across 39 themes passing**.
- `npm run audit:launch`: **111 API routes passing static audit**.
- `node --test tests/ios-native-contracts-integrity.test.mjs`: **7 / 7 passing**.
- Syntax checks for all changed JS/MJS route/library files: **PASS**.

### Native source/static validation

- Swift parser validation over application, unit-test and UI-test Swift sources with Swift 6.2: **PASS**.
- `PrivacyInfo.xcprivacy`: **valid plist**.
- `spotly.entitlements`: **valid plist**.
- iOS hard-coded Spotly HTTP route literals checked against the companion web source: **20 / 20 present**.

## External/runtime validation still required

This packaging environment is Linux and does not include Xcode or Apple SDKs, so a full `xcodebuild`, simulator UI suite, physical-device run and TestFlight archive could not be executed here. The project must receive a final Xcode 27 compile/test pass on macOS.

The live production route smoke script could not reach `spotlyafrica.com` from this container because outbound DNS returned `EAI_AGAIN`. Therefore the new backend routes are source-validated but still need to be deployed and then smoke-tested against the real host.

## External configuration that must not be fabricated

- Real Firebase **iOS App ID** for bundle identifier `com.denzeltinashe.spotly` → set `FIREBASE_IOS_APP_ID` in the native configuration.
- Apple Push Notifications capability/credential for the same App ID.
- Firebase APNs credential / FCM production setup.

No server secret or fake Firebase iOS App ID has been inserted into the project.

## Deployment order

1. Deploy the companion Spotly Web/backend package.
2. Run `node scripts/audit-ios-contracts.mjs` against `https://spotlyafrica.com` (optionally with `SPOTLY_ID_TOKEN` to verify authenticated Activity returns 200).
3. Add the real Firebase iOS App ID and confirm APNs/FCM.
4. Open the Xcode project in Xcode 27, resolve signing, build and run tests.
5. Validate on iPhone 17 Pro Max plus at least one smaller iPhone, then physical device/TestFlight.
6. After the new Activity and batch Saved routes are confirmed live everywhere, the narrow 404 compatibility bridges can be removed in a later cleanup release.
