Modular architecture note:
- Read `.codex/context/modular-platform.md` first for the canonical shared-vs-module rules, tricycle vs jeepney boundaries, and future multi-module direction.

You are working inside an existing Next.js App Router + TypeScript + Prisma + Supabase project for a tricycle booking system.

Important rules:
- Do NOT rewrite the whole project.
- Implement only the requested phase.
- Preserve existing working behavior unless the phase explicitly changes it.
- Inspect the repository first before editing.
- Reuse existing patterns, components, utilities, auth flow, and styling where reasonable.
- Prefer incremental refactors over big-bang replacement.
- Keep tenant scoping strict.
- Keep Reservations and Trips separate.
- Do NOT add digital payments.
- Do NOT add notifications.
- Do NOT add passenger/customer management to tenant admin.
- Do NOT add driver reassignment workflows.
- Prefer table-first admin UI, tabs, filters, drawers, and structured layouts over excessive cards.
- Use practical admin UX, not flashy dashboard design.
- If a page has fake controls or non-persistent forms, either wire them properly if the phase requires it or clearly reduce/hide them.
- Before coding, inspect relevant files and summarize:
  1. files to change
  2. data model impact
  3. routes/pages impacted
  4. migration impact
  5. risks
- Then implement the phase.
- After implementation, provide:
  1. summary of changes
  2. changed files
  3. migration steps
  4. manual QA checklist
  5. follow-up recommendations for next phase


Important rules:
- Do NOT rewrite the whole passenger app at once.
- Implement only the requested phase.
- Scan the codebase first before changing anything.
- Preserve existing working behavior unless this phase explicitly changes it.
- Reuse existing layouts, components, map primitives, auth flow, and styling patterns where possible.
- Keep the passenger app separate from the driver app.
- Do NOT merge passenger and driver pages into one shared mobile shell if their workflows differ.
- Keep passenger mobile-first.
- Keep on-demand rides and TODA reservations as separate concepts.
- Do NOT add digital payments unless the phase explicitly says so.
- Do NOT invent wallet functionality if it is not real in code.
- Do NOT add ratings/reviews unless explicitly requested.
- Prefer focused mobile UX:
  - bottom navigation for main destinations
  - top-right account/profile access
  - map + bottom sheet where appropriate
  - clear state-driven screens
- Before coding, inspect the repository and summarize:
  1. files to change
  2. routes/pages impacted
  3. data/API impact
  4. migration impact
  5. risks
- Then implement only the requested phase.
- After implementation, provide:
  1. summary of changes
  2. changed files
  3. migration steps if any
  4. manual QA checklist
  5. follow-up notes for the next phase

  **Repository Scan Summary**
- Key driver routes/pages: [driver layout](/c:/Users/apera/Projects/trissea-pwa/app/driver/layout.tsx), [driver dashboard](/c:/Users/apera/Projects/trissea-pwa/app/driver/dashboard/page.tsx), [assigned rides](/c:/Users/apera/Projects/trissea-pwa/app/driver/offers/page.tsx), [active trip](/c:/Users/apera/Projects/trissea-pwa/app/driver/active-trip/page.tsx), [TODA queue](/c:/Users/apera/Projects/trissea-pwa/app/driver/toda/page.tsx), [history](/c:/Users/apera/Projects/trissea-pwa/app/driver/history/page.tsx), [earnings](/c:/Users/apera/Projects/trissea-pwa/app/driver/earnings/page.tsx).
- Key auth/onboarding files: [driver login](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/login/page.tsx), [driver signup](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/signup/page.tsx), [driver onboarding](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/onboarding/page.tsx), [driver status](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/status/page.tsx), [SMS send API](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/send/route.ts), [SMS verify API](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts).
- Key trip/queue files: [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts), [ride FSM](/c:/Users/apera/Projects/trissea-pwa/lib/booking/fsm.ts), [driver assigned API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/assigned/route.ts), [driver active ride API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/active-ride/route.ts), [driver presence API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/presence/route.ts), [terminal requests API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/toda/terminals/%5BterminalId%5D/requests/route.ts).
- Key layout/components: [shared auth shell](/c:/Users/apera/Projects/trissea-pwa/components/auth/mobile-auth-shell.tsx), [app header](/c:/Users/apera/Projects/trissea-pwa/components/app-header.tsx), [mobile topbar](/c:/Users/apera/Projects/trissea-pwa/components/mobile-user-topbar.tsx), [sidebar layout](/c:/Users/apera/Projects/trissea-pwa/components/sidebar-layout.tsx), [bottom nav](/c:/Users/apera/Projects/trissea-pwa/components/bottom-nav.tsx), [map view](/c:/Users/apera/Projects/trissea-pwa/components/map-view.tsx), [page state](/c:/Users/apera/Projects/trissea-pwa/components/page-state.tsx), [status badge](/c:/Users/apera/Projects/trissea-pwa/components/status-badge.tsx).
- Key models/services: [Prisma schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [driver domain](/c:/Users/apera/Projects/trissea-pwa/lib/driver-domain.ts), [booking auth](/c:/Users/apera/Projects/trissea-pwa/lib/booking/auth.ts), [driver access](/c:/Users/apera/Projects/trissea-pwa/lib/driver-access.ts), [tenant context](/c:/Users/apera/Projects/trissea-pwa/lib/tenant-context.ts), [driver navigation](/c:/Users/apera/Projects/trissea-pwa/lib/driver-navigation.tsx), [driver presence hook](/c:/Users/apera/Projects/trissea-pwa/hooks/use-driver-presence.ts), [realtime hook](/c:/Users/apera/Projects/trissea-pwa/hooks/use-booking-realtime.ts).

**Driver Module Overview**
- The driver side is a tenant-scoped, mobile-first operational app for verified drivers handling on-demand rides and monitoring terminal request queues; it is not a generic open-market ride-hailing module.
- Existing driver pages: login, signup, onboarding placeholder, status, dashboard, assigned rides, active trip, TODA queue, history, earnings.
- Complete-ish flows: driver signup with OTP, admin verification gate, online/offline presence, auto-dispatched on-demand rides, trip state transitions, history, earnings.
- Incomplete or missing: profile, settings, account editing, document upload, document resubmission, rejection flow, reservation-facing UI, explicit driver queue position, payout workflow, real live driver tracking on trip maps.
- Not found in codebase: `/driver/profile`, `/driver/settings`, `/driver/account`, dedicated driver reservations page, dedicated TODA assignment page, dedicated availability page.

**Driver Theme/UX Assessment**
- The driver area is clearly mobile-first: centered narrow shell, sticky mobile topbar, bottom nav, compact cards, and a PWA-style layout via [sidebar layout](/c:/Users/apera/Projects/trissea-pwa/components/sidebar-layout.tsx) and [bottom nav](/c:/Users/apera/Projects/trissea-pwa/components/bottom-nav.tsx).
- Strong reusable language already present: shared auth shell, rounded cards, status chips, loading/error states, and a shared topbar architecture with passenger through [app header](/c:/Users/apera/Projects/trissea-pwa/components/app-header.tsx) and [mobile topbar](/c:/Users/apera/Projects/trissea-pwa/components/mobile-user-topbar.tsx).
- Current driver UX is mixed: dashboard is more polished/mobile-native, while offers/history/earnings still lean on generic cards/tables and feel more utility-first than flow-first.
- Map usage exists mainly on active trip via [active trip](/c:/Users/apera/Projects/trissea-pwa/app/driver/active-trip/page.tsx) and [map view](/c:/Users/apera/Projects/trissea-pwa/components/map-view.tsx); the rest of the driver module is card-heavy and list-heavy, not map-heavy.
- Weak spots: route naming mismatch (`/driver/offers` without actual offer-accept flow), status/onboarding pages use a different shell, queue-position copy is not backed by data, and several buttons/copy imply features that are not actually implemented.

**Driver Business Rules Extracted From Code**
- Confirmed: drivers must be verified and unrestricted to access operational APIs/pages; online presence is heartbeat-based; on-demand rides are auto-dispatched by terminal; driver trip states follow a strict FSM; passenger reservations exist separately from on-demand rides.
- Confirmed: dispatch is tenant-scoped and effectively terminal-line based, using `onlineSinceAt` or `lastHeartbeatAt` plus nearest-terminal matching from live coordinates in [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts).
- Conflicts/mismatches: pending/restricted drivers are intended to go to `/driver/status`, but `/api/me` uses [requireBookingProfile](/c:/Users/apera/Projects/trissea-pwa/lib/booking/auth.ts) which blocks pending/restricted drivers before the status page can receive their profile; driver login also defaults to passenger creation if a brand-new phone is verified.
- Conflicts/mismatches: dashboard has an explicit duty toggle, but [offers](/c:/Users/apera/Projects/trissea-pwa/app/driver/offers/page.tsx) and [active trip](/c:/Users/apera/Projects/trissea-pwa/app/driver/active-trip/page.tsx) post online presence automatically.
- Needs confirmation: whether TODA assignment should be static via `DriverProfile.todaId` or dynamic via nearest live terminal; whether drivers are supposed to handle reservations directly; whether earnings should be gross fare or net payout.

**Open Questions**
- Should driver login ever create an account, or should creation be signup-only? This matters because current login can create a passenger profile for a new phone.
- Should pending/restricted drivers be able to load `/api/me` and land on status, or should they be fully blocked? This affects the entire auth and gating flow.
- Is `DriverProfile.todaId` meant to control dispatch, or is location-based nearest-terminal dispatch the intended rule? Current code stores TODA assignment but does not enforce it operationally.
- Are reservations a driver workflow or only a passenger/admin queue workflow? The backend has partial driver hooks, but the driver UI does not.
- Should geolocation be mandatory before a driver can go online in multi-terminal tenants? Current code allows online-without-coordinates but may leave the driver undispatchable.
- Should document review be per-document, account-level only, or both? The schema supports more than the runtime review flow.

---

**1. Executive Summary**
- The current driver module is a mobile-first driver operations app for verified tenant drivers, centered on on-demand rides that are auto-dispatched from TODA/terminal queues. Core evidence: [driver pages](/c:/Users/apera/Projects/trissea-pwa/app/driver/dashboard/page.tsx), [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts), [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma).
- What works today: OTP-based signup/login, tenant resolution from LGU during signup, admin verification/restriction, online/offline presence, terminal-based auto-dispatch for on-demand rides, active trip state transitions, ride history, and earnings summaries.
- What is missing: driver profile/settings, real onboarding completion after signup, document upload/resubmission, reject-review flow, driver-facing reservation workflow, real queue-position UX, payout/settlement, and true live driver map updates.
- What needs clarification: pending/restricted auth routing, whether TODA assignment is static or location-driven, whether reservations belong in the driver app, and whether earnings should reflect gross fare or payout.

**2. Evidence-Based Driver Overview**
- Platform role of the driver: a tenant-scoped operational actor under `User.role = driver`, with runtime access gated by verification and restriction state in [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [driver access](/c:/Users/apera/Projects/trissea-pwa/lib/driver-access.ts), and [booking auth](/c:/Users/apera/Projects/trissea-pwa/lib/booking/auth.ts).
- Driver scope today: receive auto-assigned on-demand rides, move rides through lifecycle states, monitor terminal request boards, and review personal ride/earnings history. Evidence: [dashboard](/c:/Users/apera/Projects/trissea-pwa/app/driver/dashboard/page.tsx), [offers](/c:/Users/apera/Projects/trissea-pwa/app/driver/offers/page.tsx), [active trip](/c:/Users/apera/Projects/trissea-pwa/app/driver/active-trip/page.tsx), [TODA page](/c:/Users/apera/Projects/trissea-pwa/app/driver/toda/page.tsx).
- Routes/pages: public `/driver/login`, `/driver/signup`, `/driver/onboarding`, `/driver/status`; protected `/driver/dashboard`, `/driver/offers`, `/driver/active-trip`, `/driver/toda`, `/driver/history`, `/driver/earnings`. Evidence: [driver layout](/c:/Users/apera/Projects/trissea-pwa/app/driver/layout.tsx).
- Major flows: OTP auth, driver signup onboarding capture, admin approval/restriction, duty/presence updates, auto-dispatch, trip lifecycle transitions, historical review. Evidence: [SMS verify](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts), [admin verification](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/admin/drivers/%5BdriverId%5D/verification/route.ts), [presence route](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/presence/route.ts), [ride transition route](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/rides/%5BrideId%5D/transition/route.ts).

**3. Confirmed Driver Business Rules**
- Confirmed from code:
- Drivers must be `verified` and not `restricted` for operational API access in [booking auth](/c:/Users/apera/Projects/trissea-pwa/lib/booking/auth.ts).
- Driver signup resolves tenant from selected LGU, with province fallback in [tenant context](/c:/Users/apera/Projects/trissea-pwa/lib/tenant-context.ts).
- Online/offline state is driven by `DriverPresence` heartbeats in [presence hook](/c:/Users/apera/Projects/trissea-pwa/hooks/use-driver-presence.ts) and [presence API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/presence/route.ts).
- On-demand dispatch is automatic, terminal-based, and queue-ordered by `onlineSinceAt`/`lastHeartbeatAt` in [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts).
- Driver ride transitions are `matched -> en_route -> arrived -> in_trip -> completed`, with driver cancel allowed only before trip start in [ride FSM](/c:/Users/apera/Projects/trissea-pwa/lib/booking/fsm.ts) and [booking FSM tests](/c:/Users/apera/Projects/trissea-pwa/tests/booking-fsm.test.ts).
- Implied from code:
- The intended dispatch model is terminal/TODA line dispatch, not request-accept bidding; `/driver/offers` is really an assigned-rides screen, and `DriverOffer` is not used by the live driver flow.
- Multi-terminal dispatch depends heavily on driver geolocation; without coordinates, a driver can go online but may not be dispatchable unless the tenant has only one terminal.
- Conflicts/mismatches:
- Pending/restricted drivers are supposed to use `/driver/status`, but `/api/me` depends on [requireBookingProfile](/c:/Users/apera/Projects/trissea-pwa/lib/booking/auth.ts), which throws `DRIVER_NOT_VERIFIED` or `DRIVER_RESTRICTED`; that conflicts with [status page](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/status/page.tsx), [role gate](/c:/Users/apera/Projects/trissea-pwa/components/role-gate.tsx), and driver login/signup post-verify logic.
- [Driver login](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/login/page.tsx) verifies OTP without `signupRole`, but [SMS verify](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts) defaults `signupRole` to `passenger`; a brand-new number can therefore create a passenger account from the driver login flow.
- The dashboard exposes explicit duty control, but [offers](/c:/Users/apera/Projects/trissea-pwa/app/driver/offers/page.tsx) and [active trip](/c:/Users/apera/Projects/trissea-pwa/app/driver/active-trip/page.tsx) call `useDriverPresence({ enabled: Boolean(isDriver) })`, which can make a driver online just by visiting those pages.
- `DriverProfile.todaId` exists in [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma) but is not used in dispatch; current dispatch is nearest-terminal-based.
- Needs confirmation:
- Whether TODA assignment should be a hard operational constraint.
- Whether reservations should ever be owned/completed by a specific driver.
- Whether driver earnings should be gross fares or payout after commission/settlement.

**4. Driver Page Inventory**
- `/driver/login`: OTP sign-in for existing drivers; actions `Send OTP`, `Verify and Continue`; depends on [SMS send](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/send/route.ts), [SMS verify](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts), and `/api/me`; readiness `usable but incomplete` because pending/restricted handling conflicts with `/api/me`. Evidence: [driver login page](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/login/page.tsx).
- `/driver/signup`: 4-step driver account creation; actions collect identity, LGU, license, vehicle, phone, OTP verify; depends on [LGU API](/c:/Users/apera/Projects/trissea-pwa/app/api/psgc/lgus/route.ts), [SMS verify](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts), [driver domain](/c:/Users/apera/Projects/trissea-pwa/lib/driver-domain.ts); readiness `usable but incomplete` because TODA assignment is not actually done here, terms are not persisted for drivers, and post-verify pending flow conflicts with `/api/me`.
- `/driver/onboarding`: static informational page; actions `View Driver Status`, `Driver Login`; data dependencies none; readiness `placeholder/incomplete`; evidence: [driver onboarding page](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/onboarding/page.tsx).
- `/driver/status`: supposed pending/restricted holding page; actions go to login or home; depends on `/api/me`; readiness `placeholder/incomplete` because restricted details rely on data that `/api/me` currently blocks. Evidence: [driver status page](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/status/page.tsx).
- `/driver/dashboard`: main driver home; actions toggle online/offline, open active trip, open assigned rides, open TODA queue; depends on [driver summary API](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/driver/summary/route.ts) and [presence hook](/c:/Users/apera/Projects/trissea-pwa/hooks/use-driver-presence.ts); readiness `usable but incomplete` because it does not show real queue position, TODA assignment, or live assignment updates.
- `/driver/offers`: assigned active on-demand rides list; actions open active trip; depends on [driver assigned API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/assigned/route.ts) and realtime; readiness `usable but incomplete` because there is no accept/reject/skip flow and the route name implies offers that do not exist.
- `/driver/active-trip`: trip execution page; actions transition ride status and optionally cancel before trip start; depends on [active ride API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/active-ride/route.ts), [transition API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/rides/%5BrideId%5D/transition/route.ts), [map view](/c:/Users/apera/Projects/trissea-pwa/components/map-view.tsx); readiness `usable but incomplete` because passenger contact is placeholder, passenger count is hardcoded, and driver marker is not truly live.
- `/driver/toda`: terminal request monitor; actions switch terminals, inspect queued and in-progress requests, open active trip if it is yours; depends on [terminals API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/toda/terminals/route.ts) and [terminal requests API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/toda/terminals/%5BterminalId%5D/requests/route.ts); readiness `usable but incomplete` because it shows passenger ride queues, not driver queue position, and does not surface reservation operations or manual dispatch.
- `/driver/history`: ride history table; actions none beyond viewing; depends on [driver history API](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/driver/history/route.ts); readiness `usable`.
- `/driver/earnings`: earnings summary and completed-ride table; actions none beyond viewing; depends on [driver earnings API](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/driver/earnings/route.ts); readiness `usable but narrow` because it reflects completed fare totals, not payout/settlement.
- Not found in codebase: driver profile page, driver settings page, account page, reservations page, document upload page, resubmission page, dedicated availability page.

**5. Driver Flows**
- Sign in: enter phone in [driver login](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/login/page.tsx), send OTP through [SMS send](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/send/route.ts), verify through [SMS verify](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts), then fetch `/api/me` and route via [role routes](/c:/Users/apera/Projects/trissea-pwa/lib/role-routes.ts); conflict: pending/restricted drivers may not resolve cleanly because `/api/me` blocks them.
- Sign up / account creation: complete 4-step form in [driver signup](/c:/Users/apera/Projects/trissea-pwa/app/%28public-auth%29/driver/signup/page.tsx), verify OTP with `signupRole:'driver'`, resolve tenant by LGU in [tenant context](/c:/Users/apera/Projects/trissea-pwa/lib/tenant-context.ts), create/update `User` + `DriverProfile` + onboarding documents in [SMS verify](/c:/Users/apera/Projects/trissea-pwa/app/api/auth/sms/verify/route.ts) and [driver domain](/c:/Users/apera/Projects/trissea-pwa/lib/driver-domain.ts).
- Onboarding: separate `/driver/onboarding` page exists, but it is not part of the actual post-signup flow; `Implied but not implemented`.
- OTP verification: shared SMS verification route handles both passenger and driver; local dev also supports a fixed OTP via [dev SMS auth](/c:/Users/apera/Projects/trissea-pwa/lib/dev-sms-auth.ts).
- Going online/offline: dashboard button posts to [driver presence API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/presence/route.ts); [use-driver-presence](/c:/Users/apera/Projects/trissea-pwa/hooks/use-driver-presence.ts) heartbeats every 10 seconds and posts offline on cleanup.
- Receiving work: passenger creates on-demand ride, ride is tagged to nearest terminal, then auto-dispatch chooses the next online driver in line for that terminal in [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts); driver sees the result in `/driver/offers`, `/driver/active-trip`, or `/driver/toda`.
- Active trip handling: driver uses [active trip page](/c:/Users/apera/Projects/trissea-pwa/app/driver/active-trip/page.tsx) to run `start_heading`, `arrive_pickup`, `start_trip`, `complete_trip`, or `driver_cancel` through [transition route](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/rides/%5BrideId%5D/transition/route.ts).
- Trip completion/cancellation handling: completing or cancelling an assigned ride can trigger next terminal auto-dispatch in [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts); driver cancel is blocked once trip is `in_trip`.
- History/activity viewing: `/driver/history` and `/driver/earnings` are read-only views over driver rides in [driver history API](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/driver/history/route.ts) and [driver earnings API](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/driver/earnings/route.ts).
- Profile/settings: `Not found in codebase`.

**6. Driver Entities and Relationships**
- `User`: the auth-linked identity with `role`, `tenantId`, `isDriverVerified`, `isDriverRestricted`, `driverRestrictionReason`, `driverRestrictedAt`, `rating`, `completedRides`, `balance`, `bankAccount`; one driver `User` can have one `DriverProfile`, one `DriverPresence`, and many `Ride` records. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma).
- `DriverProfile`: the driver domain record with legal name, DOB, address, license, vehicle, `todaId`, verification/restriction/operational states, and admin-review timestamps; linked to `User`, `Tenant`, optional `TODATerminal`, documents, reviews, and restriction logs. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [driver domain](/c:/Users/apera/Projects/trissea-pwa/lib/driver-domain.ts).
- `DriverPresence`: one row per driver, storing `isOnline`, location, heading, accuracy, `onlineSinceAt`, and `lastHeartbeatAt`; used for dispatch ordering and operational state syncing. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [presence API](/c:/Users/apera/Projects/trissea-pwa/app/api/bookings/driver/presence/route.ts).
- `Ride`: on-demand trip entity linking tenant, passenger, optional driver, optional terminal, route labels/coordinates, fare, duration, ride status, and a snapshot `driverLatitude/driverLongitude`; driver-facing active flows only use on-demand rides. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts).
- `Reservation`: terminal queue entity with tenant, passenger, terminal, boarding time, status, and queue position; `Reservation` has no `driverId`, so reservation handling is not attributable to a specific driver. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma).
- `Tenant`: top-level LGU scope; drivers belong to a tenant through `User.tenantId` and `DriverProfile.tenantId`. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [tenant context](/c:/Users/apera/Projects/trissea-pwa/lib/tenant-context.ts).
- `TODATerminal`: operational terminal/TODA with name, location, coordinates, capacity, and current queue count; linked to rides, reservations, and optional driver profiles. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma).
- Driver onboarding/document entities: `DriverDocument`, `DriverVerificationReview`, and `DriverRestrictionLog` exist and are admin-visible, but runtime onboarding only auto-creates metadata records for license and TODA membership; file upload/viewing is `Implied but not implemented`. Evidence: [driver domain](/c:/Users/apera/Projects/trissea-pwa/lib/driver-domain.ts), [admin driver detail](/c:/Users/apera/Projects/trissea-pwa/app/admin/drivers/%5BdriverId%5D/page.tsx).
- Earnings: there is no payout ledger or settlement entity; driver earnings screens sum `Ride.fare` from completed rides. `User.balance` and `bankAccount` exist but are not used in driver pages. Evidence: [driver earnings API](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/driver/earnings/route.ts), [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma).
- `DriverOffer`: model exists in [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), but `Not found in live driver flow`; current UI and dispatch logic use direct `Ride` assignment instead.

**7. Driver State and Status Definitions**
- Driver verification/restriction/access:
- Access states in [driver access](/c:/Users/apera/Projects/trissea-pwa/lib/driver-access.ts): `not-driver`, `pending`, `restricted`, `active`.
- Driver profile enums in [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma): `verificationStatus = pending|verified`, `restrictionStatus = unrestricted|restricted`, `operationalState = pending_review|offline|online|restricted`.
- Runtime rule in [booking auth](/c:/Users/apera/Projects/trissea-pwa/lib/booking/auth.ts): pending drivers throw `DRIVER_NOT_VERIFIED`; restricted drivers throw `DRIVER_RESTRICTED`.
- Online/offline presence:
- Presence row tracks `isOnline`, geolocation, `onlineSinceAt`, `lastHeartbeatAt`; stale online drivers are cleaned up after heartbeat expiry in [booking service](/c:/Users/apera/Projects/trissea-pwa/lib/booking/service.ts) and [booking constants](/c:/Users/apera/Projects/trissea-pwa/lib/booking/constants.ts).
- Rides/trips:
- Ride statuses in [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma): `searching`, `matched`, `en_route`, `arrived`, `in_trip`, `completed`, `cancelled`.
- Driver-active statuses in [booking types](/c:/Users/apera/Projects/trissea-pwa/lib/booking/types.ts): `matched`, `en_route`, `arrived`, `in_trip`.
- Reservation statuses:
- `pending`, `confirmed`, `arrived`, `completed`, `cancelled` exist in [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma); driver UI does not currently surface them.
- Onboarding/review:
- `DriverDocument.reviewStatus` supports `submitted|approved|rejected`, and `DriverVerificationDecision` supports `approved|rejected`, but runtime admin flow only implements approval/restriction, not reject/re-submit. Evidence: [schema](/c:/Users/apera/Projects/trissea-pwa/prisma/schema.prisma), [verification route](/c:/Users/apera/Projects/trissea-pwa/app/api/dashboard/admin/drivers/%5BdriverId%5D/verification/route.ts).

**8. Driver UX/UI Findings**
- Current layout/style: mobile-first PWA shell with [mobile topbar](/c:/Users/apera/Projects/trissea-pwa/components/mobile-user-topbar.tsx), [bottom nav](/c:/Users/apera/Projects/trissea-pwa/components/bottom-nav.tsx), centered narrow content, rounded cards, and status badges.
- Current strengths: clear mobile shell, clean auth entry, simple trip-state actions, shared visual system with passenger, and a real map on active trip.
- Weak spots: dashboard is more polished than the rest of the module; offers/history/earnings still feel more generic; onboarding/status are visually inconsistent with login/signup; several screens use copy that overpromises unavailable functionality.
- Reusable design language: shared auth shell, shared topbar, shared page states, shared status badges, shared driver nav metadata, and shared map stack are worth preserving.
- Likely redesign opportunities later: align auth/status flows, make duty state consistent, make queue/assignment model explicit, decide whether TODA is a driver line or a terminal monitor, and simplify the “offers vs trips” naming.

**9. Open Questions**
- Should `/driver/login` be login-only, or is implicit account creation acceptable there? This matters because current generic OTP verification defaults to passenger creation.
- Should pending/restricted drivers be able to fetch `/api/me` and load the status screen with real status details? This matters because the current gate logic and status UX do not line up.
- Is `todaId` intended to be authoritative, informational, or admin-only? This matters because the current dispatch engine ignores it.
- Are drivers supposed to work reservations at all? This matters because the schema and services have partial reservation support, but the driver app does not.
- Should drivers see only their assigned terminal, or all tenant terminals? This matters because `/driver/toda` currently exposes every terminal in the tenant.
- Should geolocation failure block going online in multi-terminal tenants? This matters because a driver can look online while being undispatchable.
- Should document review and driver approval be separate workflows? This matters because the schema models both, but runtime approval is account-level only.
- Should earnings mean fare totals, net payouts, or wallet balance? This matters because the driver UI currently uses completed fares only.

**10. Readiness Assessment**
- Ready now:
- Verified driver on-demand trip lifecycle from `matched` to `completed`.
- Admin verify/restrict gating for drivers.
- Basic driver history and gross-fare earnings views.
- Usable but incomplete:
- Driver signup and login.
- Driver dashboard and duty control.
- TODA queue monitor for on-demand requests.
- Placeholder/incomplete:
- Driver onboarding continuation page.
- Driver status page for pending/restricted states.
- Document workflow, reject flow, live map accuracy, queue-position UX.
- Missing entirely:
- Driver profile/settings/account management.
- Driver document upload/resubmission.
- Driver-facing reservation workflow.
- Payout/settlement/wallet workflow.
- Explicit driver queue-position model.

**11. Recommendation for Next Planning Step**
- Clarify the driver access contract first: login vs signup behavior, pending/restricted `/api/me` behavior, and whether status is a real post-auth holding area.
- Audit the dispatch model next: static TODA assignment vs nearest-terminal dispatch, whether all-tenant terminal visibility is intended, and whether geolocation should be mandatory for duty-on.
- Decide whether reservations belong in the driver product before redesigning navigation; the current model is too partial to treat as a stable feature.
- After those decisions, redesign later around one coherent driver journey: authenticate, get approved, go on duty, receive work, execute trip, review activity.
