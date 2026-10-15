# Spotly Driver V8 — Full Production Product & Technical Audit

**Audit date:** 15 October 2026  
**Source of truth:** the latest full Spotly Next.js project carried forward from the Staff V8 / Careers work in this conversation.  
**Scope:** public Driver acquisition, zero-to-active onboarding, Driver workspace, rides, merchant deliveries, shop-and-deliver grocery flows, Send, earnings, safety/support, lifecycle states, mobile/PWA behavior, Admin Driver Operations, security/authority, dispatch integrity and production tests.  
**Audit-only pass:** no production deployment and no GitHub push were performed. This report defines the rebuild target; it does not claim the Driver rebuild has already been implemented.

---

## Executive verdict

Spotly Driver is not empty or fake. It has a significantly better server foundation than its current product experience communicates. Ride, Send and delivery state machines exist; sensitive operations are server-authoritative; money has an authoritative ledger; Driver documents are private; payout destinations are encrypted and reviewed; active work uses pickup/handoff verification; grocery shopping has a real funded-basket/reconciliation model; Driver/Admin notifications exist; and the current Driver/Delivery/Ride/Send production suites pass 33/33 tests.

The problem is that Driver is **between generations**.

The public `/drive` page is newer. Ride and Send backends are comparatively mature. Grocery shopping has meaningful transactional logic. But the actual Driver workspace remains a compact, mostly generic single component that treats onboarding, rides, prepared deliveries, shop-and-deliver, Send, money, incidents and profile as variations of one workflow. That is no longer enough for the platform Spotly has become.

The result is a product where the backend often knows more than the Driver UI explains, while several important operational rules are inconsistent between work types.

The required rebuild is not “make Driver prettier.” It is to turn Driver into a **field operating system** that is safe, understandable, capability-aware, mobile-first and honest about what the Driver can do at every moment.

A Driver should never have to infer:

**Can I work? What is blocking me? What work am I allowed to do? Is this offer worth accepting? What do I do next? Am I safe? What did I earn?**

That standard should apply from the first visit to `/drive` through the first completed job and every later renewal, hold, payout or support issue.

---

# 1. Production maturity assessment

| Area | Current state | Verdict |
|---|---|---|
| Server-authoritative job state | Real state machines for delivery, Ride and Send | Strong foundation |
| Firestore/security boundaries | Sensitive operational collections are browser-denied and accessed through APIs | Strong foundation |
| Driver Money | Ledger, balances, payout requests, encrypted payout destination, finance review | Strong foundation with UX gaps |
| Public Driver acquisition | Visually newer but too high-level | Partial |
| Zero → active onboarding | Functional wizard, but generic and contradictory by vehicle/work type | Needs rebuild |
| Application review status | Basic submitted/review/info-required/approved handling | Incomplete |
| Driver lifecycle | Backend has more statuses than UI correctly handles | Production defect |
| Capability/work eligibility | One Driver account, mostly one generic requirement model | Major architecture gap |
| Online readiness | Basic GPS + go-online gate | Partial |
| Driver Home | Answers some basic questions but not full operating readiness | Partial |
| Offers | Ride/Send clearer than generic delivery | Mixed generations |
| Prepared delivery | Basic pickup → handoff works | Partial |
| Grocery shop-and-deliver | Real basket/reconciliation logic, weak substitution/checkout/customer communication UX | Significant gaps |
| Ride | Core state machine works, safety/contact/no-show tooling is thin | Significant gaps |
| Send | PIN + proof foundations exist, parcel context/failure/privacy tooling is thin | Significant gaps |
| Safety | Incident form exists; emergency/safety toolkit does not | Production gap |
| Support | Can report incidents, but weak live resolution workflow | Partial |
| Earnings | Authoritative money exists; statement is too ledger-like and some work is undercounted in UI | Partial |
| Documents/renewals | Review states exist; expiry/renewal experience is weak | Partial |
| Mobile/field ergonomics | Responsive web shell, but still designed like a workspace rather than an active field app | Needs rebuild |
| GPS/network recovery | Dispatch protects against stale location; Driver UI hides failures | Production gap |
| Admin Driver Operations | Can review/approve/hold/suspend and inspect money/location | Functional but record-centric |
| End-to-end regression coverage | 33/33 current production tests passed | Good core coverage, insufficient state/UX coverage |

---

# 2. The product model Driver should use

Driver needs two completely different modes.

## Before activation: “Help me become ready”

The product should answer:

**Can I qualify?**  
**What work can I do with my vehicle?**  
**What does Spotly still need from me?**  
**What has Spotly already approved?**  
**Who owns the next step: me or Spotly?**  
**When can I start earning?**

This is not the normal Driver workspace. It is an **Activation Centre**.

## After activation: “Help me work safely and earn”

The product should answer:

**Am I ready to go online?**  
**Which work types are active for me?**  
**Is my GPS/network/device healthy?**  
**What offers are available and are they worth accepting?**  
**What is my exact next action on the current job?**  
**How do I handle an exception without improvising?**  
**What did I earn and what money do I owe/receive?**  
**Is anything about my account going to stop me working soon?**

Trying to make one generic dashboard serve both modes is one of the reasons Driver currently feels behind the newer V8 products.

---

# 3. Zero → active: complete journey audit

This is the most important path in the rebuild.

## Stage 0 — “Could I become a Spotly Driver?”

### Current

`/drive` explains Rides, Deliveries and Send, says requirements vary, and sends the person into Spotly Driver.

### Missing

The visitor cannot determine enough before creating/signing into an account:

- whether their city is currently accepting Drivers;
- whether their bicycle/motorcycle/car/van qualifies;
- which work types that vehicle can unlock;
- whether Spotly requires a driving licence for the specific work they want;
- which documents they should prepare;
- whether they can use a rented/fleet vehicle;
- whether a payout account must be ready immediately;
- what the review process looks like;
- what “approved” versus “ready to work” means;
- approximate review expectations;
- how location is used while online;
- what Driver costs/responsibilities exist;
- what happens if a document is rejected;
- what the first job experience looks like.

### Required

Add a short eligibility planner before sign-in:

**City → vehicle → work I want to do → personalized requirements.**

The result should say something like:

> “With a motorcycle in Harare, you may be eligible for prepared deliveries, shop-and-deliver and Send. Passenger rides have additional requirements. Here is what to prepare.”

Do not promise acceptance. Do eliminate avoidable uncertainty.

---

## Stage 1 — Account creation and application entry

### Current

Driver uses the shared Spotly authentication system. The Driver auth gate can create/sign into an account.

### Problem

The entry language still assumes someone is already a working Driver in places. A first-time applicant can encounter framing such as continuing a “Driver shift,” which is premature.

### Required

Auth copy must be state-aware:

- New user: **Start your Driver application**
- Returning applicant: **Continue your application**
- Under review: **Check your application**
- Active Driver: **Open Driver**

A Driver applicant should not be asked to understand the distinction between a normal Spotly account and a Driver profile.

---

## Stage 2 — Choose how you want to work

### Current

There is no true capability selection. The application asks for a vehicle, then uses a universal requirements path.

### Major problem

Spotly now has materially different work:

- passenger rides;
- restaurant/prepared order delivery;
- prepared grocery/retail delivery;
- grocery shop-and-deliver;
- Send parcel/courier work;
- potentially bulky/van work later.

These should not have one universal qualification checklist.

### Required architecture: Driver capability packs

Create explicit Driver capabilities such as:

| Capability | Typical vehicles | Extra requirements / training |
|---|---|---|
| `prepared_delivery` | bicycle, motorcycle, car, van as configured | general safety, delivery handoff, food/parcel handling as applicable |
| `shop_and_deliver` | configured vehicles | shopping training, substitutions, checkout/reconciliation, cold/fragile handling |
| `send` | bicycle/motorcycle/car/van depending parcel size | prohibited items, parcel condition, PIN/PoD, return/failure process |
| `ride_passenger` | approved passenger-capable car/van | passenger transport requirements, ride safety, vehicle category requirements |
| `bulky_delivery` | van/approved larger vehicles | load limits, loading assistance, dimensions/weight handling |

Each capability should independently be:

**not requested → requirements incomplete → in review → active → temporarily blocked → removed.**

A Driver who is eligible for bicycle delivery should not be forced through passenger-ride requirements before earning from deliveries.

---

## Stage 3 — Vehicle setup

### Current

Driver can choose motorcycle, car, van or bicycle. The application then requires a registration string for every choice.

### Confirmed defect

A **bicycle** applicant is still required to enter vehicle registration, and the generic application readiness model also requires a driving licence and a vehicle document. That is an internally contradictory onboarding path.

### Required

Requirements must be generated from the selected vehicle + capability + city policy.

Examples:

- Bicycle delivery should not inherit motor-vehicle registration fields merely because cars use them.
- A car used for Ride can require stronger vehicle evidence than a bicycle used for prepared food delivery.
- Rented/fleet-owned vehicles should have their own ownership evidence and approval workflow.
- Vehicle profile should include useful operational fields such as make/model/year, capacity/category, photos/inspection where required, and expiry-sensitive documents.

Multiple vehicles should eventually be supported. An active Driver should choose the currently used approved vehicle before going online; capability availability should update accordingly.

---

## Stage 4 — Documents

### Current strengths

- Driver uploads are stored privately.
- Admin can approve/reject each document.
- Rejection reason can be shown.
- Document expiry is supported in data.

### Current problems

The application presents the same document list to every Driver. The front-end step blocks only on identity and licence, while submission later also requires a vehicle document. That means a Driver can apparently complete the documents page and only later discover another blocker.

Admin approval and operational eligibility are also inconsistent:

- application readiness requires identity, licence and at least one registration/insurance document;
- Admin application approval requires approved vehicle + approved identity + approved licence;
- operational eligibility defaults to approved identity + licence + approved vehicle;
- vehicle registration/insurance approval is not part of the default online eligibility unless separately configured.

This produces multiple definitions of “ready.”

### Required

One authoritative requirement engine should determine:

**required → uploaded → under review → approved → expiring soon → expired/rejected.**

The same engine must be used by:

- the applicant;
- Admin Driver Operations;
- application approval;
- capability activation;
- go-online eligibility;
- offer acceptance.

Document cards should explain why each document is required, show expiry, show exact rejection reason, and give one-tap replacement.

The Driver should never see “all done” while the server knows another requirement is missing.

---

## Stage 5 — Getting paid

### Current strengths

- mobile money and bank destinations exist;
- sensitive identifier is encrypted server-side;
- Driver sees a masked identifier later;
- Admin/finance verifies the payout destination;
- re-authentication is required before replacing a verified destination;
- payout requests use authoritative balance buckets.

### Current gaps

Payout is positioned as just another onboarding step, but the product does not clearly distinguish:

- payout details saved;
- payout details under review;
- verified payout destination;
- Driver operational activation;
- earnings available but payout blocked.

The Driver account can become operational while payout verification remains unresolved. That may be intentional, but the UX must explain the policy.

### Required

Use a separate money readiness state:

**Can work / Can receive payout.**

If Spotly allows work while payout verification is pending, say so explicitly and warn before balance becomes frustrating. If verification must block activation, make that part of the capability readiness engine.

Active Drivers must be able to replace/manage payout details from Driver Money/Profile, not only from the application wizard.

---

## Stage 6 — Training

### Current

The final application screen shows six safety statements and a “Mark training complete” action.

### Problem

This is self-attestation, not meaningful capability training. The submission logic also attempts to mark training complete during the final submit path, which weakens the distinction between “read the material” and “completed required training.”

### Required

Training should be short, mobile and capability-specific:

- General Driver safety and privacy
- GPS/location and phone safety
- Ride passenger verification and no-show/safety handling
- Prepared order pickup, food/drink handling and missing/damaged bag process
- Shop-and-deliver substitutions, prices, checkout and receipt
- Send prohibited items, parcel condition, PIN and failed handoff/return
- Cash handling where Spotly enables cash

Completion should be recorded per module, versioned, and re-requestable when policy changes.

Do not turn this into a corporate LMS. Five-minute operating modules with one or two comprehension checks are enough.

---

## Stage 7 — Review

### Current

Applications can become submitted, under review, information required or approved. Admin receives a queue item and notifications can go to the Driver.

### Gaps

The Driver does not get a strong timeline explaining:

- what Spotly is reviewing;
- what is already approved;
- what is blocked by the Driver;
- what is blocked by Spotly;
- which capability is waiting;
- what was rejected and exactly how to fix it;
- review timestamps;
- expected next step.

A `rejected` application is not treated as a deliberate terminal/appealable state in the main Driver render logic. It can fall back into the editable application experience rather than clearly showing the decision.

### Required

The Activation Centre should have a real status timeline:

**Application received → identity review → vehicle review → capability training → payout review → activation.**

Each task should carry an owner:

**You need to act** or **Spotly is reviewing**.

If rejected, show a dedicated decision state, the reason, whether reapplication is possible, and support/appeal options. Never silently reopen the wizard as though nothing happened.

---

## Stage 8 — Approval and activation

### Current

Admin approval writes the application to `approved` and creates/updates the Driver record with `status: ready`.

### Problem

The product treats Driver status as a global boolean-like gate, even though different work types have different requirements.

There is also terminology drift between `approved`, `ready` and `active` without a user-facing definition.

### Required

Separate:

**Person/account status** from **work capability status**.

For example:

- Driver account: active
- Prepared delivery: active
- Send: active
- Shop & deliver: training needed
- Ride: vehicle inspection pending

This allows a Driver to start earning as soon as at least one capability is active instead of waiting for unrelated work types.

Activation needs a strong completion screen:

> “You’re ready to earn.”
>
> Active now: Prepared delivery, Send  
> Still being reviewed: Ride  
> Next: check your phone, location and notifications, then go online.

---

## Stage 9 — First go-online readiness

### Current

Going online asks for a current high-accuracy GPS position. Push permission is requested asynchronously. Dispatch rejects stale locations.

### Problem

The Driver sees online/offline, but not a full **work readiness check**.

Location watch errors are silently swallowed. A Driver can think they remain online while GPS has stopped updating; dispatch will quietly exclude stale location after two minutes.

### Required

Before and while online, show health for:

| Check | Driver-facing state |
|---|---|
| Account/capability | Ready / action needed |
| Current approved vehicle | Selected and valid |
| Required documents | Valid / expiring / blocked |
| GPS | Good / weak / stale / permission lost |
| Network | Connected / unstable / offline |
| Push notifications | On / off |
| Safety contact | Set / missing |
| Payout | Verified / pending / blocked for payout |
| Active work | Free / on job |

The online indicator should mean **actually dispatchable**, not merely “the browser once toggled online.”

---

## Stage 10 — First offer and first completed job

### Current

Offers can arrive and the active workflow gives sequential actions.

### Required

The first job should have optional contextual coaching, not a giant tutorial:

- “This is a Shop & Deliver order — you are doing the shopping.”
- “This restaurant prepared the order — do not shop for items.”
- “Ask for the pickup PIN only after confirming the rider.”
- “This Send parcel requires delivery photo.”

After first completion, show a clean success receipt:

**Job complete · earnings · cash/digital settlement · what happens next.**

At that point the Driver has genuinely gone from zero to active.

---

# 4. Critical lifecycle defects

The Driver backend recognizes a richer lifecycle than the UI correctly handles.

Current states include variants such as:

**application started, submitted, under review, information required, approved/ready/active, temporarily unavailable, suspended, offboarded.**

But the main Driver render currently shows the normal workspace only for `approved`, `ready` and `active`. Any other Driver status falls back to `DriverApplication`.

That means a **suspended or offboarded Driver can be routed back into onboarding UI** instead of seeing a suspension/offboarding state. This is a production-state defect, not merely copy polish.

Driver V8 needs explicit state surfaces for:

| State | Required experience |
|---|---|
| Brand-new | eligibility + application start |
| Application in progress | resumable checklist |
| Submitted | review timeline; nothing falsely editable |
| Information required | exact task list + replace/resubmit |
| Rejected | decision + reason + allowed next action/appeal |
| Approved but setup incomplete | activation checklist |
| Ready/active | normal Driver workspace |
| Temporarily unavailable | reason + expected recovery action |
| Compliance hold | exact compliance blocker + fix path |
| Safety hold | restricted access + safety/support path |
| Document expired | blocked capability + renewal action |
| Suspended | reason + support/appeal; no application wizard |
| Offboarding | return/settlement/account close steps |
| Former/offboarded | history/pay documents/support as policy allows; no live work |

---

# 5. Driver capability model — the central rebuild

The current global Driver eligibility model is too coarse for the number of Spotly work types.

A capability model solves multiple current problems at once:

- bicycle contradictions;
- Ride vs delivery documentation;
- shop-and-deliver training;
- parcel vehicle compatibility;
- city-by-city rollout;
- future van/bulky work;
- capability-specific suspensions;
- work preferences while online.

Recommended conceptual record:

```text
driver account
  identity/lifecycle
  vehicles[]
  documents[]
  capabilities[]
    capabilityId
    status
    city/zone eligibility
    approved vehicle(s)
    required requirements snapshot
    training status
    hold/restriction reason
    activatedAt
    expires/renewal requirements
```

The user-facing language should still be human:

**Rides · Ready**  
**Deliveries · Ready**  
**Shop & deliver · Finish training**  
**Send · Ready**

Do not expose internal permission architecture.

---

# 6. Home / “Today” audit

The current Driver Home partially answers the right questions: online state, nearby offer count, available earnings and active job.

It is not yet sufficient as the Driver’s daily operating surface.

## Driver Home should change by state

### Active Driver, offline

Primary hierarchy:

**Ready to work?**  
Go online button  
Work capabilities active today  
GPS/notification/document health  
Today’s earnings  
Anything requiring attention  
Optional current demand/coverage information

### Online and idle

Primary hierarchy:

**You are online and dispatchable**  
Selected vehicle  
Work types enabled  
GPS/network freshness  
Current offer / offer queue  
Time online  
Today’s earnings

### Active job

The Home shell should collapse behind the active work experience. The job is now the product.

### Account blocked

The blocking state should replace the go-online control with one obvious reason and next action.

### First-week Driver

Show lightweight operating tips and first-job readiness until they are no longer useful.

---

# 7. Navigation and visual generation audit

Current Driver navigation is:

**Home · Jobs · Active job · Earnings · History · Notifications · Safety & support · Profile**

This is understandable, but it is still an office-workspace navigation model.

Driver should be optimized for a person standing at a store, sitting safely parked in a vehicle, walking a parcel to a door or checking earnings on a low-to-mid-range phone.

Recommended V8 information architecture:

| Area | Purpose |
|---|---|
| Home | readiness, online state, next work, today |
| Work | offers + work preferences/capabilities + optional planned availability |
| Active | contextual persistent surface only while work exists |
| Earnings | job earnings, cash obligations, payouts |
| Activity | completed/cancelled work and support-linked history |
| Safety | always accessible safety toolkit |
| Account | vehicle, documents, work capabilities, payout, preferences, help |

Notifications can remain a global drawer/centre instead of consuming one of the primary mobile tabs.

On mobile, use a bottom navigation or similarly reachable control set. When a job is active, a persistent **Resume job** control must survive navigation.

Black/white office-style density is wrong for this product. Spotly Driver should keep its blue identity, but the visual language should prioritize:

- larger touch targets;
- stronger state color/shape distinction;
- fewer simultaneous panels;
- map/location context;
- large “next action” cards;
- highly legible pay/distance/time;
- unmistakable safety action;
- minimal interaction while moving.

Driver should feel related to Spotly V8, not identical to Staff/Admin/Business.

---

# 8. Offers audit

## Current Ride offer

Shows:

- pay;
- distance to pickup;
- trip distance;
- estimated trip minutes;
- route areas.

This is the strongest of the three current offer types.

## Current Send offer

Shows:

- pay;
- pickup distance;
- delivery distance;
- parcel size.

Useful, but incomplete.

## Current generic delivery offer

Shows:

- business/pickup;
- drop-off area;
- pay;
- distance to pickup;
- “expected time”;
- bag count.

### Major delivery-offer problem

The backend already sends `fulfilmentMode`, but the offer card does not surface it.

A Driver can therefore be deciding between:

**“Pick up a ready restaurant order”** and **“Enter a supermarket and shop an entire basket”** without the offer clearly elevating that difference.

That is not acceptable. Work type is part of the economic value of the offer.

## Every offer should show

| Information | Why it matters |
|---|---|
| Work type | Ride / prepared delivery / shop & deliver / Send / bulky |
| Guaranteed/estimated Driver pay | earnings decision |
| Distance to pickup | unpaid positioning cost |
| Work distance | actual job travel |
| Estimated total work time | not only pickup ETA |
| Pickup business/type | operating context |
| Load/item count/parcel size | physical workload |
| Shopping item count if applicable | major labor difference |
| Cash/digital money mode | Driver cash obligation |
| Special handling | food, fragile, cold, high value, bulky |
| Required vehicle/equipment | prevents unsuitable acceptance |
| Offer expiry countdown | avoids invisible 409/expired errors |
| Pickup/drop-off areas | route decision |

A Driver should know the shape of the job before accepting, without exposing private customer information unnecessarily.

---

# 9. Dispatch and acceptance integrity

This audit found real cross-generation inconsistencies.

## Ride

Ride offer acceptance re-checks the full operational eligibility model and required vehicle compatibility at the moment of acceptance. This is the strongest current pattern and should become canonical.

## Generic merchant delivery

Dispatch checks operational eligibility and vehicle type, but acceptance later only re-checks broad Driver status/holds and online/free presence. It does not re-run the full document/vehicle eligibility check.

If a document expires, vehicle approval changes or eligibility is revoked after the offer is generated, a stale offer can have weaker acceptance protection than Ride.

## Send

The same issue exists: dispatch checks stronger eligibility/vehicle compatibility than the acceptance route re-checks.

## Required

Create one server-side `assertDriverCanAcceptWork()` / equivalent that is used by every work type inside the acceptance transaction.

It should validate:

- Driver lifecycle;
- relevant capability active;
- current approved selected vehicle;
- requirement/doc validity;
- capability/vehicle compatibility;
- compliance/safety hold;
- fresh enough presence/location as required;
- no conflicting active work;
- offer/job still valid.

Ride currently demonstrates the direction.

---

# 10. Merchant delivery dispatch defect

Ride and Send dispatch include distance-aware operational controls.

Generic merchant delivery currently gathers eligible online Drivers, calculates distance to pickup, sorts them and selects the nearest candidates—but there is no comparable maximum pickup-distance cut-off in the delivery dispatcher.

That means a delivery can be offered to a Driver who is technically the “nearest” eligible Driver even when they are operationally too far away.

The current `expectedMinutes` attached to a delivery offer is also calculated from **distance to pickup**, not estimated total job duration. For a grocery shop-and-deliver job this can be radically misleading because it excludes shopping time and the customer delivery leg.

## Required

Delivery dispatch needs configurable limits by city/capability/business mode:

- max pickup distance/time;
- business preparation/readiness;
- total route estimate;
- shopping time estimate based on item count/store profile;
- vehicle/capacity compatibility;
- service area and zones;
- driver capability;
- optional queue/stacking strategy later.

Offer “estimated time” must represent the work the Driver is accepting, not only how long it takes to reach pickup.

---

# 11. Restaurant / prepared-food delivery

Prepared restaurant delivery and shop-and-deliver are currently both treated as generic `delivery` once the Driver sees the offer, even though their operational behavior differs substantially.

For restaurant/café/fast-food delivery, Driver V8 should support:

| Need | Driver behavior |
|---|---|
| Order readiness | show “ready / still preparing” when Business can supply it |
| Pickup point | entrance/counter/collection instructions |
| Wait state | “order not ready” action + timer rather than falsely progressing |
| Bag/drink verification | confirm bags/drinks without exposing sensitive order internals unnecessarily |
| Hot/cold handling | simple handling reminder where applicable |
| Sealed/damaged order | exception path before leaving |
| Merchant closed/cannot find merchant | structured exception |
| Pickup code | retain server-verified pickup workflow |
| Customer unreachable | timed resolution/return guidance |
| Delivery PIN | retain secure handoff workflow |

The Driver should not be asked to improvise “what do I do if the restaurant says 15 more minutes?” via a generic support form.

---

# 12. Grocery / shop-and-deliver audit

This is one of the better backend foundations and one of the biggest UX opportunities.

## What already works well

- Driver-shopping is a distinct `fulfilmentMode`.
- Customer payment must be confirmed before shopping.
- Basket has an authorized customer-funded maximum.
- Driver records found/replaced/unavailable item outcomes.
- Server blocks a basket above the funded limit.
- Checkout review exists.
- Receipt upload is required.
- Final reconciliation calculates actual subtotal/final total.
- Unused reserve can create a customer money adjustment/refund requirement.
- Driver is explicitly told not to use personal money.

These are important foundations worth preserving.

## Major gaps

### 12.1 Substitution preference is displayed but not actually enforced end-to-end

The customer can choose preferences such as contact me, best match or no substitutions. Driver currently sees the preference as text, but the item-update API will still accept a manually typed replacement without a customer-approval workflow.

There is no first-class:

- pre-approved substitute;
- customer approve/reject substitute;
- “contact customer” action;
- response timer;
- automatic refund/remove outcome based on no response;
- policy enforcement for “no substitutions.”

This must be fixed. Current mature shop-and-deliver systems explicitly connect out-of-stock handling to customer-approved substitutes or customer contact instead of leaving replacement choice as unstructured text.

### 12.2 Item identification is weak

The Driver gets name, requested quantity and estimated price. Missing useful shopping support includes:

- product image;
- brand/size/variant;
- barcode/scan verification where appropriate;
- category/aisle grouping;
- customer item notes;
- unit/weight handling;
- weighed produce;
- replacement suggestions;
- photo option for uncertain replacements.

### 12.3 Checkout authorization is not visible

The code reconciles Spotly customer funds and tells the Driver not to use personal money, but the Driver flow does not expose a clear in-store tender/authorization mechanism such as a Spotly checkout code, cashier authorization, QR or funded payment instrument.

If checkout is intentionally handled through an existing merchant-side process outside this Driver code, Driver must clearly surface that process. If there is no separate mechanism, this is a P0 operational gap: the Driver cannot simply reconcile a receipt after goods have somehow left the till.

### 12.4 Grocery handling needs actual operating guidance

Driver V8 should guide:

- check fresh produce quality;
- frozen/chilled items later in the shop;
- separate fragile/heavy items;
- cold-chain/insulated-bag expectations where used;
- restricted/age-sensitive goods only if Spotly has a compliant policy;
- checkout discrepancy resolution;
- receipt capture quality;
- bag count after checkout.

This should be concise and contextual, not generic training clutter.

---

# 13. Prepared grocery / retail delivery

Not every supermarket/retailer will use Driver Shops. Some may prepare the order themselves.

Those jobs should still differ from restaurant food delivery.

Potential operational fields include:

- bag count from actual packed order, not a default constant;
- chilled/frozen flag;
- fragile flag;
- age/identity-check requirement where legally/policy appropriate;
- bulky/heavy flag;
- collection bay/counter;
- order-ready time;
- loading assistance;
- vehicle capacity requirement.

The current order creation path defaults generic delivery `bagCount` in a way that can make “load” informationally weak. The offer should use actual merchant/packing data when available.

---

# 14. Retail / hardware / bulky delivery

Spotly Business supports varied business archetypes. Driver cannot assume every merchant order is restaurant-sized.

Before enabling broad retail categories for Driver dispatch, the delivery job should carry an operational profile snapshot such as:

**prepared_food · prepared_retail · grocery_shopping · fragile · chilled · bulky · high_value · age_check**

For hardware/furniture/appliance-type work, the offer may need:

- package count;
- dimensions;
- estimated weight;
- van/car requirement;
- loading assistance;
- stairs/access notes;
- two-person handling flag;
- proof requirements.

Do not route this as “1 bag.”

---

# 15. Ride audit

## Current strengths

- separate Ride offers;
- pickup and trip distance;
- configurable Ride services/vehicle requirements;
- transactional offer acceptance;
- vehicle/eligibility re-check at acceptance;
- pickup PIN before trip start;
- cash vs digital money handling in backend;
- customer rating capability exists after completion.

## Missing Driver operating features

### Contact and identity

Driver does not have a strong masked call/chat surface to the rider. The imported phone icon is not actually turned into a ride communication workflow.

### Wait / no-show

There is no clear arrival wait timer, no-show path, rider cancellation context or structured “rider not here” resolution.

### Safety

Safety is a link to the general support page, not an always-available in-trip safety toolkit.

### Trip exceptions

Missing first-class flows for:

- rider cannot be found;
- wrong rider;
- unsafe rider;
- rider requests route change;
- vehicle issue;
- crash;
- trip must end early;
- cash issue;
- fare/route dispute.

### Driver quality

The product does not show useful Driver quality/performance context even though rating-related data exists in the broader Ride system.

The goal is not gamification. Driver should know if ratings, cancellations or compliance issues are putting access at risk and how to correct them.

---

# 16. Send audit

## Current strengths

- Send is a real separate job type;
- vehicle compatibility exists in dispatch;
- pickup and recipient PINs exist;
- proof of delivery can be required;
- prohibited-item acknowledgement and parcel-size limits are server-enforced;
- cash vs digital money logic exists;
- scheduled Send is supported server-side.

## Driver UI gaps

The offer/active flow underuses parcel data. A Driver should know, as policy allows:

- parcel description/category;
- size and weight;
- declared value/high-value warning where used;
- fragile/handling flags;
- prohibited-item acknowledgement state;
- proof requirement;
- sender/recipient special instructions;
- return requirement if recipient is unavailable.

The current active Send screen exposes raw sender/recipient phone information. Driver V8 should prefer masked/in-app communications where feasible rather than exposing personal phone numbers directly.

Send also needs structured outcomes for:

- sender unavailable;
- parcel differs materially from declaration;
- unsafe/prohibited item suspected;
- recipient unavailable;
- recipient refuses parcel;
- failed delivery/return-to-sender;
- damaged parcel.

---

# 17. Active job experience

The current sequential “one clear next step” idea is correct and should be preserved.

The rebuild should make the active job the strongest screen in the whole product.

Recommended hierarchy:

**NOW** — exact current action  
**NEXT** — what follows after completion  
**MAP / NAVIGATE** — destination  
**PAY / JOB SUMMARY** — relevant money and load  
**CONTACT** — masked/contextual contact  
**PROBLEM** — context-specific exception menu  
**SAFETY** — always visible  
**PROGRESS** — lightweight step indicator

Do not make Drivers navigate into a generic support form for common operational exceptions.

Contextual exception examples:

| Context | Fast actions |
|---|---|
| Restaurant pickup | order not ready, merchant closed, wrong/missing package, damaged package |
| Grocery shopping | item unavailable, substitute approval, funded limit issue, checkout issue |
| Customer delivery | cannot find address, customer unreachable, unsafe location, damaged order |
| Ride pickup | rider not here, wrong rider, unsafe pickup |
| Ride | emergency, end trip early, route issue, vehicle issue |
| Send | parcel mismatch, sender unavailable, recipient unavailable, return required |

Every exception should have a server-side state/audit effect where operationally relevant, not only a free-text incident.

---

# 18. Safety audit

The current “Safety & support” section can submit a low/medium/high/critical incident. That is useful for logging, but a critical incident form is not an emergency experience.

Current local/global mobility products commonly provide directly accessible safety tools such as emergency assistance, trip sharing and in-app support. Spotly does not need to copy every feature, but Driver V8 needs a deliberate safety model.

Minimum safety toolkit:

| Tool | Purpose |
|---|---|
| Emergency assistance | immediate route to local emergency services; show live location/job/vehicle info to relay |
| Spotly urgent support | high-priority operations/safety escalation |
| Share current trip/job | trusted contact safety option |
| Report crash/incident | structured, job-linked flow |
| Unsafe customer/rider/merchant | fast safety escalation |
| Vehicle breakdown | operational + safety handling |
| Current location | clearly visible for emergency communication |
| Safety contact | configurable trusted/emergency contact |

Safety must be reachable from Home and every active job without hunting through navigation.

Spotly should also define what “critical” incident reporting does operationally: create priority queue, alert on-call staff, potentially freeze/re-route the job, and follow up with the Driver.

---

# 19. GPS, connection and field reliability

This is a major difference between an office product and Driver.

## Current

- Go-online requires a fresh geolocation fix.
- A live geolocation watcher sends updates approximately every 15 seconds.
- Dispatch excludes stale location after approximately two minutes.
- Live-location update failures in the browser are swallowed.
- Global connectivity banner exists.

## Problem

A Driver can be told “You’re online” while the dispatch system has stopped considering them because their location is stale.

## Required

Driver needs a visible health model:

**Location good · Location weak · Location lost · Network offline · Reconnecting.**

If the Driver becomes effectively undispatchable, say so and guide them to fix it.

Active jobs should remain recoverable after refresh/network interruption. Driver V8 should cache enough active-job context to avoid a blank/unsafe experience when connectivity drops, while server authority remains canonical when the connection returns.

Mutating actions need idempotent/retry-safe UX. Never encourage the Driver to repeatedly tap “Complete delivery” because the network status is unclear.

PWA install guidance is valuable, but “offline” should not pretend live job operations can fully continue without network.

---

# 20. Availability, shifts and work preferences

`data/portals.js` currently describes Driver as managing “offers, active jobs, shifts, and earnings,” but there is no Driver shift/schedule product in the current navigation/backend.

That is a product-contract mismatch.

Spotly must choose deliberately:

### If Drivers are primarily on-demand independent partners

Use **Availability**, not “shifts.” Drivers can go online whenever eligible, with optional planned availability to help Spotly forecast coverage.

### If some Drivers are fleet/employed/scheduled

Support a work-arrangement-specific schedule model:

- independent/on-demand;
- fleet scheduled;
- employee scheduled.

Do not show a mandatory shift concept to everyone unless the operating model actually requires it.

Work preferences should eventually allow eligible Drivers to choose what they are accepting during a session:

**Rides on/off · Deliveries on/off · Shop & deliver on/off · Send on/off**

subject to city/network rules.

---

# 21. Earnings and Driver Money audit

The underlying money architecture is materially stronger than the presentation.

## Current strengths

- authoritative Driver ledger;
- balance buckets;
- payout requests;
- payout status/history;
- verified payout destination;
- cash and digital work can be treated differently server-side.

## Current UI problems

### 21.1 Send undercount

The “completed earning events” summary filters `delivery_earned` and `ride_earned` but does not include the parcel/Send earning type. It can therefore understate completed earning events.

### 21.2 Multi-currency mismatch

Bootstrap returns USD and ZWG balances, while the Driver earnings request UI is effectively USD-only and ignores the ZWG account in its main presentation.

### 21.3 Internal ledger language

The statement exposes ledger-style event labels/references instead of a Driver-friendly earnings statement.

### 21.4 Job economics are disconnected

The Driver should be able to open a completed job and see:

- job pay;
- bonuses/tips if Spotly supports them;
- cash collected if applicable;
- Spotly fee/amount owed where applicable;
- adjustments;
- payout status.

### 21.5 Payout recovery

Need explicit flows for rejected payout destination, failed payout, changed wallet/account and expected payout timing.

## Required Driver Money information architecture

**Today · This week · Available · Cash/amount owed · Payouts · Earnings activity.**

Money should be understandable without learning Spotly’s ledger schema.

---

# 22. Profile / account audit

Current Profile shows:

- Driver identity/status;
- one vehicle;
- document list/status;
- online eligibility checks;
- link to general account settings.

Missing self-service includes:

- capability/work approvals;
- document expiry and renewal action;
- replace rejected/expiring document after activation;
- add/change vehicle;
- select active vehicle;
- vehicle photos/inspection where required;
- update work areas/preferences;
- payout destination management;
- emergency contact;
- location/privacy explanation;
- account hold reason;
- suspension/appeal path;
- service-specific training status;
- equipment status if Spotly issues bags/gear;
- versioned agreements/policies.

“Why can I go online?” is a good concept. It should become **Account health**, with each failed check linking directly to the fix.

---

# 23. Notifications audit

Driver uses the shared notification system and push can be enabled.

For Driver, notifications need stronger action hierarchy than an office inbox.

Priority classes should include:

**Offer now**  
**Active job changed**  
**Action required to keep working**  
**Payout/money**  
**Application/review**  
**Safety/support**  
**General announcement**

Offers currently expire server-side after short windows, but offer cards do not visibly show the countdown/expiry. The Driver can experience an offer vanishing or receiving an expired response without seeing urgency.

Use a visible countdown/progress treatment for live offers.

---

# 24. Support audit

The incident endpoint is a good foundation because it attaches active work IDs and structured category/severity.

The support product still needs:

- incident/ticket status history;
- what Spotly is doing next;
- high-priority live support route;
- contextual pre-filled actions from active job;
- customer/merchant unreachable timers;
- breakdown workflow;
- failed delivery/return workflow;
- payout dispute path;
- account/document appeal path;
- safety follow-up.

Support should answer **“what happens now?”**, not just “your message was sent.”

---

# 25. Admin Driver Operations audit

Admin can currently:

- review applications;
- inspect current Driver status/location;
- approve vehicle;
- approve/reject documents;
- approve/reject application;
- request information;
- suspend/reinstate;
- add/clear compliance/safety holds;
- verify payout destination;
- process payout states;
- end Driver session.

That is a meaningful control plane.

The issue is that it is **record-centric**, not **activation-flow-centric**.

Admin Driver Operations needs an operational queue with views such as:

| Queue | What Ops needs to know |
|---|---|
| New applications | age, city, capability requested, completeness |
| Ready for review | all Driver-owned tasks complete |
| Waiting on Driver | exact missing/rejected evidence |
| Waiting on Spotly | review SLA/owner |
| Vehicle review | evidence + capability compatibility |
| Document expiry | upcoming operational risk |
| Capability activation | what can be switched on now |
| First-week Drivers | first-job issues / support exceptions |
| Safety/compliance hold | reason, owner, next review |
| Payout issue | money-specific queue |
| Offboarding | active jobs, balances, equipment/vehicle access as relevant |

Driver and Admin must use the same requirement/capability engine so they cannot disagree about why someone is not active.

---

# 26. Driver status vs capability status vs presence

The rebuild should explicitly separate three concepts currently blended together.

## Driver lifecycle

Who is this person in the Driver network?

**applicant · active · suspended · offboarding · former**

## Capability

What work may they perform?

**prepared delivery active · Ride pending · Send active · shop-and-deliver blocked**

## Presence

What are they doing right now?

**offline · online/free · offered · on ride · on delivery · on Send · reconnecting**

This separation will make UI and server rules much easier to reason about.

---

# 27. Business type → Driver operating profile

Business V8 already recognizes that businesses are not interchangeable. Driver must consume that truth.

The delivery job should snapshot a Driver-facing operating profile at creation so the active job remains stable even if a merchant edits settings later.

Recommended examples:

| Business/work archetype | Driver operating profile |
|---|---|
| Restaurant / café | prepared food, ready/wait state, bags, drinks, hot/cold, pickup code |
| Grocery — Driver shops | item list, substitution policy, checkout authorization, receipt, chilled/frozen handling |
| Grocery — merchant prepared | packed bags, chilled/frozen flags, collection bay, bag verification |
| General retail | prepared retail, fragile/high-value flags, package count |
| Bakery/florist | fragile/perishable handling |
| Hardware/home | weight/dimensions, van/capacity, loading assistance |
| Pharmacy/regulated category | only enable with explicit compliance/identity/privacy policy |
| Ride | passenger capacity/category, pickup/no-show, trip safety |
| Send | parcel declaration, weight/size/value/fragile/proof/return |

`fulfilmentMode` should remain, but it is not enough by itself to describe Driver work.

---

# 28. Driver UI component architecture

The current Driver experience lives predominantly in one approximately 370-line `components/driver-app.js` file containing:

- application;
- availability;
- live location;
- offers;
- Driver Home;
- grocery shopping;
- active merchant delivery;
- active Send;
- active Ride;
- earnings;
- history;
- support;
- profile.

This is a strong signal of the generation mismatch versus newer Business/Admin/Staff surfaces.

Driver V8 should be modularized around product responsibilities, for example:

```text
components/driver/
  activation/
  home/
  availability/
  offers/
  active/
    prepared-delivery/
    shopping/
    ride/
    send/
  earnings/
  safety/
  support/
  account/
  shared/
```

This is not refactoring for aesthetics. It allows the product to model different work correctly without turning one component into an increasingly unsafe conditional tree.

---

# 29. Concrete technical inconsistencies found

## 29.1 Bicycle eligibility contradiction

Bicycle exists as a selectable vehicle, but vehicle registration and licence are globally required by the application/readiness model.

**Severity: P0 onboarding correctness.**

## 29.2 Application requirements disagree across layers

Application readiness, Admin approval and go-online eligibility use different document requirements.

**Severity: P0 authority consistency.**

## 29.3 Suspended/offboarded account rendered as application

Main Driver component only treats approved/ready/active as workspace states; other Driver records fall into application UI.

**Severity: P0 lifecycle correctness.**

## 29.4 Rejected application lacks dedicated terminal state

Rejected is written by Admin but not included in the deliberate review-state UI branch.

**Severity: P0/P1 lifecycle clarity.**

## 29.5 Delivery acceptance has weaker eligibility re-check than Ride

Ride re-runs full operational eligibility + vehicle compatibility at acceptance. Generic delivery does not.

**Severity: P0 compliance/dispatch integrity.**

## 29.6 Send acceptance has weaker eligibility re-check than Ride

Same stale-offer risk.

**Severity: P0 compliance/dispatch integrity.**

## 29.7 Generic delivery has no max pickup radius

Can offer impractically distant work to the nearest available Driver.

**Severity: P0/P1 marketplace quality.**

## 29.8 Delivery expected time is not total work time

Current estimate is effectively derived from distance to pickup.

**Severity: P1 offer transparency/economics.**

## 29.9 Delivery offer hides fulfilment mode

Driver cannot clearly distinguish prepared pickup from shop-and-deliver before acceptance.

**Severity: P0/P1 offer transparency.**

## 29.10 Offer expiry not visibly counted down

Server enforces expiry but UI does not clearly communicate it.

**Severity: P1.**

## 29.11 Live location failure is silent

Watcher errors are swallowed while online state can remain visible.

**Severity: P0/P1 field reliability.**

## 29.12 Generic delivery presence metadata is inconsistent

Ride/Send write a `currentWorkType`; generic delivery acceptance does not, and delivery completion does not clearly normalize all work-type metadata.

**Severity: P1 state consistency.**

## 29.13 Shop substitution policy is not enforced

Preference is shown, but replacement can be manually entered without an approval/contact workflow.

**Severity: P0 for shop-and-deliver quality/money integrity.**

## 29.14 Shop checkout authorization is not represented

Spotly says not to use personal money, but Driver has no explicit cashier authorization/payment credential in this flow.

**Severity: P0 if no external merchant checkout mechanism exists.**

## 29.15 Raw Send phone details are presented

No masked/in-app communication layer.

**Severity: P1 privacy/safety.**

## 29.16 Safety emergency is a form, not a toolkit

“Critical” is still just a submitted incident.

**Severity: P0 safety.**

## 29.17 Earnings event count excludes Send

Summary filters delivery + Ride earning event types.

**Severity: P1 correctness.**

## 29.18 ZWG balance is fetched but not properly surfaced in Driver Money

USD is effectively hard-coded in payout request UI.

**Severity: P1 money UX/correctness.**

## 29.19 Active Driver cannot fully maintain operational profile

Weak document renewal, vehicle switching, payout maintenance, capability/training view.

**Severity: P1.**

## 29.20 “Shifts” are promised but not implemented

Portal description says Driver manages shifts, but there is no actual Driver shifts product.

**Severity: P1 product contract.**

---

# 30. Priority rebuild order

## P0 — must be fixed before calling Driver production-grade

1. Build one capability/requirement model and remove universal vehicle/document contradictions.
2. Correct every Driver lifecycle state, especially rejected/suspended/holds/offboarded.
3. Make application, Admin approval, online eligibility and offer acceptance use the same authoritative requirement logic.
4. Re-check full eligibility/capability/vehicle inside every Ride/Delivery/Send acceptance transaction.
5. Add delivery dispatch max-distance/total-work estimation and expose work type before acceptance.
6. Make GPS/location health visible and stop claiming the Driver is effectively available when location is stale.
7. Rebuild Shop & Deliver substitutions/customer approval and resolve the physical checkout authorization mechanism.
8. Add real safety/emergency tooling and operational escalation behavior.
9. Fix state/money correctness defects: work-type presence, Send earning count, currency handling.
10. Build explicit exception/return/no-show/unreachable workflows so Drivers do not improvise production operations through free-text support.

## P1 — required for V8 quality

- Activation Centre / zero-to-active timeline.
- `/drive` personalized eligibility/requirements.
- capability-specific short training.
- mobile Driver shell with active-job persistence.
- offer countdown and complete economic/work context.
- restaurant wait/not-ready workflow.
- grocery item images/variants/scan/weight handling.
- masked contact/chat/call.
- Driver Account Health with expiry renewals.
- proper Driver Money statement and payout recovery.
- support case status/history.
- Admin activation queues and SLA ownership.
- selected active vehicle and service preferences.

## P2 — network maturity

- optional planned availability/coverage planning;
- demand areas/heat maps backed by real data;
- incentives/bonuses only when Spotly has real rules;
- destination/work-area preferences;
- driver quality/performance coaching;
- first-week Driver support signals;
- fleet-owner/vehicle-partner workflows;
- smarter dispatch/stacking when operational volumes justify it.

---

# 31. Recommended Driver V8 route/product map

A possible route model while preserving clean driver-domain URLs:

```text
/                   Home / Activation Centre depending state
/work               Offers, capability preferences, online settings
/active             Current job — persistent and dominant while active
/earnings           Today/week/balance/payouts/activity
/activity           Completed/cancelled jobs + linked support history
/safety             Safety toolkit and urgent support
/account             Driver identity and account health
/account/work        capabilities, cities/zones, work preferences
/account/vehicle     approved vehicles, add/switch/renew
/account/documents   requirements, expiry, replace/review status
/account/payout      payout destination and verification
/account/training    capability training
/support             normal support/cases
```

During application, routes may instead live under a guided activation shell:

```text
/apply
/apply/work
/apply/vehicle
/apply/documents
/apply/payment
/apply/training
/application         status/timeline
```

The exact URL structure is less important than the state model.

---

# 32. Mobile design standard

Driver should be designed from phone first, then expanded to desktop—not the reverse.

Minimum mobile principles:

- core action reachable with one thumb;
- no tiny table interfaces while working;
- active job action fixed/persistent near bottom when safe;
- safety always reachable;
- large pay/time/distance typography;
- offer decision can be understood in seconds;
- do not require long text entry for common exceptions;
- camera capture is first-class for documents/receipts/PoD;
- navigation launch is one tap;
- no destructive/irreversible action without clear confirmation where necessary;
- network/GPS state visible;
- interaction minimized while vehicle is moving;
- high contrast and outdoor readability;
- data-efficient payloads and no decorative media dependency for critical actions.

---

# 33. Accessibility and clarity

Driver has extra accessibility pressure because it is used outdoors, under time pressure and by users with varying device quality and digital literacy.

Audit requirements for rebuild:

- icon + label, not icon alone for critical actions;
- status must not depend on color alone;
- large touch targets;
- readable body text and number typography;
- semantic form errors next to the field;
- document upload states announced clearly;
- loading states must preserve context;
- active job cannot disappear into a blank skeleton on refresh;
- keyboard/accessibility support on desktop remains intact;
- motion should guide state change, never delay work;
- plain Zimbabwe-appropriate English; avoid internal words like “ledger event,” “capability permission,” “dispatch entity.”

---

# 34. Production states that require explicit testing

| Scenario | Expected product result |
|---|---|
| Bicycle applicant | only requirements relevant to bicycle + selected work appear |
| Motorcycle delivery applicant | delivery/Send requirements generated correctly |
| Car Ride applicant | Ride-specific vehicle/docs/training appear |
| Applicant leaves halfway | resumes exact unfinished task |
| Document rejected | precise reason + replace button + review state |
| Application rejected | dedicated decision page, not onboarding restart |
| One capability approved before another | Driver can start eligible work if policy allows |
| Payout pending | Driver understands whether they can work and why payout is blocked |
| Driver approved | explicit activation completion + first-online checklist |
| GPS permission denied | cannot be falsely “online”; clear fix instructions |
| GPS becomes stale online | visible warning and dispatchability state changes |
| Offer expires | countdown + clean expired state |
| Document expires while offer is open | acceptance re-check blocks safely and explains fix |
| Restaurant order not ready | wait timer/exception, no fake pickup progression |
| Restaurant closed | structured cancellation/ops path |
| Grocery item unavailable | policy-specific substitute/contact/refund behavior |
| Grocery no-substitutions order | Driver cannot create unapproved replacement |
| Grocery checkout exceeds funded amount | blocked with clear resolution |
| Grocery checkout authorization fails | support/merchant resolution path |
| Ride rider absent | wait/no-show workflow |
| Ride safety incident | immediate safety toolkit and ops escalation |
| Send parcel differs from declaration | Driver can report/refuse/escalate before pickup |
| Send recipient absent | timed failed-delivery/return path |
| Cash job complete | Driver Money clearly shows cash and platform obligation |
| Digital job complete | earnings clearly credited |
| Send earning complete | included in earnings totals |
| USD and ZWG balances exist | each presented and paid correctly |
| Payout rejected | reason + update flow |
| Driver suspended | suspension screen, not application wizard |
| Compliance hold | blocker + resolution task |
| Driver offboarded | no live work; history/pay/support retained per policy |
| Network dies mid-job | active job context survives and safe retry is possible |
| App refreshes mid-job | exact state restored from server |

---

# 35. Test coverage audit

Executed against the current source tree:

```text
node --test \
  tests/driver-delivery-production.test.mjs \
  tests/rides-production.test.mjs \
  tests/send-production.test.mjs
```

**Result: 33 / 33 passed.**

Those tests confirm important foundations including:

- real production Driver data rather than seeded training jobs;
- protected pickup/handoff secrets;
- deterministic Driver money ledger behavior;
- verified payout requirements;
- Firestore protection of Driver operational collections;
- Admin approval evidence checks;
- Ride pricing/dispatch/atomic acceptance/PIN/cash vs digital behavior;
- Send pricing/dispatch/PIN/proof/cash vs digital/prohibited-item and scheduling behavior.

The passing tests do **not** prove the product is Driver-production-complete. Missing regression coverage should be added for the findings in this report, particularly:

- vehicle/capability-specific requirements;
- rejected/suspended/offboarded states;
- consistent approval/online/acceptance eligibility;
- stale-offer eligibility re-checks;
- max merchant-delivery pickup distance;
- total-work offer estimate;
- GPS stale/lost presentation;
- substitutions policy enforcement;
- checkout authorization;
- safety escalation;
- Send earning totals;
- multi-currency Driver Money;
- exception/no-show/return workflows;
- mobile state recovery.

---

# 36. External product benchmark takeaways

This audit used current official Driver/courier material only as a pattern check, not as a requirement to copy competitors.

Useful patterns confirmed by current products include:

- local Driver onboarding should clearly list required documents and vehicle rules before someone expects activation;
- document status and expiry should directly explain why an account is on hold;
- shop-and-deliver substitution flow should use pre-approved substitutes and/or customer contact rather than arbitrary replacement entry;
- shop-and-deliver needs an explicit checkout/payment mechanism;
- safety tooling belongs directly inside the Driver experience and active work, not only in a generic support form;
- Driver activation should communicate what happens after documents are verified.

Spotly should implement these principles in its own simpler V8 language and Zimbabwe operating model.

---

# 37. Definition of “Driver V8 is production-ready”

Driver V8 is not done when the pages look consistent with Business/Admin/Staff.

It is done when this scenario works without hidden knowledge:

> A person hears about Spotly Driver, opens `/drive`, learns what work they can do with their vehicle, creates an account, sees only the requirements that apply to them, uploads valid evidence, completes the correct short training, knows exactly what Spotly is reviewing, receives clear corrections if something is wrong, gets activated for each work type they qualify for, goes online with visible GPS/account health, understands the first offer before accepting it, completes the correct workflow for that type of work, gets help immediately when something goes wrong, completes the job securely and sees exactly what they earned.

And this operational scenario must also work:

> Driver Operations opens Admin and can immediately see who is ready for review, what each applicant is waiting on, which capabilities can be activated, which Drivers are about to become non-compliant, which active Drivers have GPS/safety/support exceptions, and what action an operator must take next—without manually reconciling contradictory application, document and Driver states.

And this cross-product scenario must work:

> A restaurant, supermarket, retailer, Ride request or Send request produces a Driver job whose offer and active workflow accurately reflect the actual labor, vehicle, handling, money and safety requirements of that work—not a generic “delivery” abstraction.

That is the Driver V8 standard.

---

# 38. Recommended implementation sequence after approval

The safest rebuild sequence is:

**Foundation first:** requirement/capability/lifecycle model, unified server acceptance guard, dispatch corrections, state authority.  
**Then zero-to-active:** `/drive`, activation centre, vehicle-aware application, document/training/review/activation.  
**Then daily Driver shell:** mobile Home, availability health, offers, active-job shell, account health.  
**Then work-type depth:** restaurant prepared, grocery shopping, retail/bulky, Ride, Send, contextual exceptions.  
**Then safety/money/support:** safety toolkit, communications, Driver Money V8, support cases/returns.  
**Then Admin:** capability-aware activation queues, expiries, SLA, first-week/safety exceptions.  
**Then regression/build:** comprehensive Driver V8 tests, full project tests, lint, theme safety, launch audit and production build.

This sequence avoids painting a new UI over the current contradictory eligibility model.
