# Primon Fumigation Management System (FMS) Workstream
This file combines the planned development roadmap and the reactive work log (fixes & debug sessions). It is managed by `@tasklist` (Planned Roadmap section only) and `@intake` (Reactive Log section only — `@tasklist` never writes here). It does not carry its own version number; git history and the `[x]` markers are sufficient. The SDD (`/Docs/SDD.md`) is versioned and is the contract this roadmap implements.

---

2026-09-09 — Initial roadmap generated (11 parent tasks, against SDD v1.0)

## Planned Roadmap

### 1.0 Backend & Database Infrastructure (generated against SDD v1.0)
> Nothing else in this roadmap can persist correctly until Neon + Prisma exist. Reuse the existing App Router UI; do not rebuild screens here. The current `lib/store.tsx` localStorage store is demo-only and must not become the production data layer.
- [x] 1.1 Install `prisma`, `@prisma/client`, `@prisma/adapter-neon`, and the Neon serverless driver (`@neondatabase/serverless`).
- [x] 1.2 Create `prisma/schema.prisma` covering every SDD §A.4 table with FKs and enums: `users`, `work_orders`, `fccs`, `shipping_instructions`, `fumigation_descriptions`, `fumigants`, `formulations`, `stock_levels`, `stock_movements`, `gas_readings`, `corrective_actions`, `fumigation_closeout`, `signatures`, `notifications`, `audit_log`, `household_clients`, `household_reminders`, `pending_submissions`.
- [x] 1.3 Instantiate `PrismaClient` (e.g. in `lib/prisma.ts`) configured with `@prisma/adapter-neon` and Neon’s HTTP/WebSocket serverless driver, matching SDD §A.6 / §T.2.
- [x] 1.4 Store `DATABASE_URL` (and related Neon secrets) as environment variables only; never commit them. Document required env vars for local `.env.local`.
- [x] 1.5 Generate the initial Prisma migration under `prisma/migrations/` using `npx prisma migrate dev` and generate Prisma Client (`npx prisma generate`). Prefer `prisma migrate deploy` in CI later (11.2).
- [x] 1.6 Seed reference data: fumigants (`aluminium_phosphide`, `magnesium_phosphide`) and formulations (`sachet_11g`, `tablet_1g`, `plate_33g`) with crop-type constraints and `stock_levels` + `lowStockThreshold`. Mirror the demo’s crop/stock filtering rules from `lib/fumigants.ts`.
- [x] 1.7 Optional local-only seed of the reviewed sample FCC (`FCC-2026-000512` / Alliance One) on a non-production Neon branch so UI work has a realistic row. Do not seed production.

### 2.0 Authentication & Role-Based Access (generated against SDD v1.0)
> Must land before any mutating API in 3.0+. Auth is Better Auth (Prisma adapter) writing directly to Neon Postgres — not Neon Auth. `RoleSwitcher` is a no-op.
- [x] 2.1 Integrate Better Auth and mount its handlers under `app/api/auth/[...all]` (SDD §A.5 route tree; Neon Auth was abandoned due to frontend user-sync races).
- [x] 2.2 Persist application `users` (id, name, email, role, createdAt) against Auth identities. Role enum: `supervisor` | `ops_manager` | `admin` | `client` | `executive`.
- [x] 2.3 Add `middleware.ts` that requires a Better Auth session on `/dashboard` and `/portal`. Public (unauthenticated) routes only: landing, login/auth handlers, `POST /api/intake/website`, `GET /api/verify/[certificateId]` (and the matching verify page). Role matrix (2.5) is still outstanding.
- [x] 2.4 Replace `/login` role-card sign-in with real credentials while keeping the existing two-column layout. Remove or gate the floating Demo controls (`components/role-switcher.tsx`) so it cannot impersonate roles in production.
- [ ] 2.5 Enforce the v1 permission matrix: Supervisor — gas-reading monitor + reading entry; Ops Manager — work orders, FCC lifecycle, certify, intake review; Admin — all Ops plus stock adjust; Client — own FCCs in `/portal` only; Executive — authenticated role exists, but no dashboard (SDD open item; do not invent one).
- [ ] 2.6 Document how the first Admin user is created (invite / seed) so 4.2 is not blocked on an empty `users` table.

### 3.0 Work Order Management (generated against SDD v1.0)
> Screens already exist at `/dashboard` and `/dashboard/work-orders/new`. This parent adds the SDD APIs, search/filter, header metadata, and stops the demo from generating 6-day slots at create time.
- [ ] 3.1 Implement `GET` / `POST` `app/api/work-orders/route.ts`: list/search and create. Filter by code, client, crop type, and FCC/work-order status (SDD §M.1).
- [ ] 3.2 Implement `GET` / `PATCH` `app/api/work-orders/[id]/route.ts`.
- [ ] 3.3 Auto-generate `WO-YYYY-#####` sequentially per year (do not derive the number from `workOrders.length`). Accept an externally supplied unique code; set `source` to `client_supplied` | `auto_generated` | `website`.
- [ ] 3.4 Collect and persist optional header metadata on create/edit: Sales Order No., Shipment No., Delivery No. Add `scale` value `household` alongside `industrial` | `smallholder`.
- [ ] 3.5 Wire the dashboard active-work-order table to `GET /api/work-orders` and add search/filter controls. Keep existing KPI cards, but compute them from the API (including “certified this period” as a real date window, not “all certified”).
- [ ] 3.6 Restrict the new-work-order wizard step 0 to work-order identity only. Do **not** insert `gas_readings` rows on create (that is 6.1, keyed off Date Fumigant Placed). Creating a WO should yield `fccs.status = draft` (or `in_progress` only once fumigation description is saved — match SDD lifecycle; do not jump to in_progress solely because the wizard finished).

### 4.0 Inventory, Formulations & Stock Movements (generated against SDD v1.0)
> `/dashboard/inventory` already shows on-hand levels. SDD requires Admin-only adjustments, an append-only movement log, and `quantityOnHand` as a maintained aggregate.
- [ ] 4.1 Implement `GET /api/stock` returning each formulation’s on-hand quantity, threshold, fumigant, crop type, and unit.
- [ ] 4.2 Implement `POST /api/stock/adjust` (Admin only): wrap `stock_movements` insert (`addition` | `adjustment`) + `stock_levels.quantityOnHand` update in a single DB transaction. Require a note. Never allow negative on-hand.
- [ ] 4.3 Rewrite the inventory page off `adjustStock()` ±10/±50 shortcuts: Admin-only, custom quantity, note field, and a visible movement history. Supervisors/Ops may view levels; only Admin mutates.
- [ ] 4.4 Drive formulation dropdowns from live stock (reuse `availableFormulations` rules against DB rows, including `cropType = both`).
- [ ] 4.5 Surface low/zero-stock on the dashboard stock-alerts card from API data. Enqueue Admin notification on crossing threshold (wired in 9.6).
- [ ] 4.6 Write `audit_log` rows for every stock adjustment.

### 5.0 FCC Draft, Shipping Instructions & Fumigation Description (generated against SDD v1.0)
> Certificate sheet and wizard already render SI + description. Missing SDD fields/behaviours: pre-filled Fumigation Contractor, client scoping, and **transactional stock deduction on description save** (the wizard currently claims a deduction that `createWorkOrder()` never performs).
- [ ] 5.1 Implement `GET /api/fccs/[id]` returning the FCC with SI, description, readings, close-out, and signatures.
- [ ] 5.2 Implement `PATCH /api/fccs/[id]/si`: client (own FCC) and Ops/Admin may edit until `shipping_instructions.lockedAt` is set; return 403/409 if locked. Include every SDD SI field plus **Fumigation Contractor, pre-filled** to Primon Enterprises Limited (not currently on `ShippingInstructions` in `lib/types.ts`).
- [ ] 5.3 Scope `/portal` to the authenticated client’s work orders by `clientId`. Remove the hardcoded `client.includes("Alliance One")` filter. Clients see the full FCC read-only except SI pre-certification.
- [ ] 5.4 Implement `POST`/`PATCH /api/fccs/[id]/fumigation-description`. Filter formulation by fumigant + crop type and current stock. On first save, in one transaction: write the description, insert `stock_movements` type `deduction`, decrement `quantityOnHand`. Reject if stock is insufficient. Set FCC `in_progress` when description is complete.
- [ ] 5.5 Allow SI to remain incomplete when description is saved (out-of-order completion). SI completeness must not block fumigation or readings.
- [ ] 5.6 Wire wizard steps 1–2 and the certificate SI editor to these APIs. Until 5.4 ships, do not show copy that says stock will be deducted; after 5.4, keep that copy because it will be true.
- [ ] 5.7 Show Relative Humidity on the certificate 6-day table (logged in the monitor form today, omitted from `certificate-view.tsx`).
- [ ] 5.8 Write `audit_log` diffs for SI and fumigation-description writes.

### 6.0 Gas-Reading Monitor, Flagging & Close-Out (generated against SDD v1.0)
> `/dashboard/monitor` already implements 600ppm flagging and corrective-action notes in localStorage. Align generation, actor identity, lifecycle, and aeration capture with SDD §M.1 / §A.3.
- [ ] 6.1 Recording **Date Fumigant Placed** (not work-order create) inserts six `gas_readings` rows (`dayNumber` 1–6) with sequential `readingDate`s. Until Ops confirms the SDD open item on weekends/holidays, use consecutive calendar days and record that assumption in the capsule log.
- [ ] 6.2 Implement `POST /api/readings`: require numeric Airspace and Probe/Case; temps and RH optional. Derive and **store** `status` (`compliant` if both ≥ 600ppm, `critical` if either < 600). Do not recompute status only on read. Persist `enteredBy` / `enteredAt` from the session.
- [ ] 6.3 If status is `critical`: set FCC `flagged`, enqueue Ops Manager/Admin notification (9.3), and keep the day red until a corrective action is logged. Treat `flagged` as the SDD schema enum value; preserve the previous lifecycle status in `audit_log.diff` so certification still follows `draft → in_progress → under_review → certified`.
- [ ] 6.4 Implement `POST /api/readings/[id]/corrective-action`: free-text description, timestamp, `loggedBy` from the session (**never hardcode** “Grace Phiri”). Set day status to `action_taken`. When no days remain `critical`, move FCC to `under_review` (six resolved days) or back to `in_progress` if readings are still pending.
- [ ] 6.5 Add a fumigation close-out form for Aeration Began, Aeration Completed, and Duration / Total Hours Under Gas on `fumigation_closeout`. Do **not** auto-stamp these in `certify()`.
- [ ] 6.6 Wire `/dashboard/monitor` and `/dashboard/monitor/[id]` to the APIs. Keep the existing gauges and sequential “next pending day” UX unless Ops asks to log days out of order.
- [ ] 6.7 Block certification (7.2) until all six days are `compliant` or `action_taken` **and** close-out is recorded. Write `audit_log` for every reading and corrective action.

### 7.0 Certification, Signatures, QR, PDF & Public Verify (generated against SDD v1.0)
> QR rendering (`qrcode.react`) and client-side jsPDF exist, but there are no three-party signatures, no Blob storage, no sequential FCC numbers, and no public `verify.primon.mw` route. `/certificate/[id]` currently offers PDF download even when uncertified.
- [ ] 7.1 Add the certification UI for the three SDD roles: Supervising Fumigator, For the Supplier, Certifying Officer. Persist `signatures` (`signerName`, `signedAt`, role). System timestamp stands in for wet signature.
- [ ] 7.2 Implement `POST /api/fccs/[id]/certify` as one DB transaction: require three signatures, six resolved readings, and close-out; insert/confirm signatures; set `fccs.status = certified`, `certifiedAt`, `certifiedBy`; set `shipping_instructions.lockedAt`; assign sequential `FCC-YYYY-######` (not `Math.random()`). Follow-up async job for QR/PDF is allowed after the commit (SDD §A.4).
- [ ] 7.3 Generate a QR whose payload is `https://verify.primon.mw/fcc/{certificateId}`. Store the QR image on Vercel Blob; save `fccs.qrCodeUrl`. Use signed/expiring Blob URLs for sensitive documents (SDD §M.2).
- [ ] 7.4 Generate the certified FCC PDF, store it on Vercel Blob, and expose download only when `status = certified`. Client-side html2canvas may remain as a preview aid; the Blob PDF is the downloadable artefact.
- [ ] 7.5 Implement public `GET /api/verify/[certificateId]` (rate-limited, payload-validated, read-only, non-sensitive). Add the public page routed for `verify.primon.mw` (same Vercel deployment, subdomain alias per SDD §E). Do not use `/certificate/[workOrderId]` as the public verifier.
- [ ] 7.6 Gate portal and certificate-page PDF buttons on `certified`. Target: certified FCC downloadable within 5 seconds of the certify action (SDD success metric).
- [ ] 7.7 Enqueue client + Ops Manager certified-FCC notifications (implemented in 9.4). Write `audit_log` for certification.

### 8.0 Public Website Intake (generated against SDD v1.0)
> `/dashboard/intake` is a static mock. Convert currently opens a blank wizard and does not copy the submission.
- [ ] 8.1 Implement `POST /api/intake/website`: HMAC or API-key authentication, payload validation, insert `pending_submissions` (`sourceType` work_order | rfq | rfw, `payload` jsonb, `status` pending). Idempotent on replay of the same signed payload.
- [ ] 8.2 Rate-limit this public route distinctly from internal APIs (SDD §A.5 / §S.3).
- [ ] 8.3 Implement `POST /api/intake/pending/[id]/convert`: create a work order with `source = website`, copy payload fields into the WO/FCC draft, set submission `converted`, record `reviewedBy`.
- [ ] 8.4 Support reject (and optional merge-as-duplicate) with `status = rejected` and reviewer id. Do not delete the row.
- [ ] 8.5 Wire `/dashboard/intake` to the API. Convert must pre-fill `/dashboard/work-orders/new` (client, contact, crop/service, message) instead of a blank form. Persist the inbox in the database, not `useState(mockPendingSubmissions)`.
- [ ] 8.6 Enqueue Ops Manager/Admin notification on new submission (9.5).

### 9.0 Notifications (in-app + Resend) (generated against SDD v1.0)
> Critical-reading “email” in the demo is a toast only. SDD requires in-app rows plus Resend, with notification delivery allowed to be eventually consistent.
- [ ] 9.1 Implement the `notifications` table access layer (userId, type, payload jsonb, channel `in_app` | `email`, readAt, createdAt) and an unread indicator in the existing topbar.
- [ ] 9.2 Install Resend; store the API key as a Vercel/env secret. Retry with backoff on transient failure; never fail the originating FCC/reading transaction because email failed.
- [ ] 9.3 Critical gas reading: always insert in-app rows for Ops Manager/Admin first, then send email. Dispatch within 2 minutes of reading save (SDD SLO). Staff must not depend on email alone.
- [ ] 9.4 FCC certified: in-app + email to the client and Ops Manager, including verification URL.
- [ ] 9.5 New website submission: in-app + email to Ops Manager/Admin.
- [ ] 9.6 Low/zero stock: in-app + email to Admin when on-hand crosses `lowStockThreshold` or hits zero (triggered from 4.5 / 5.4).
- [ ] 9.7 Household reminder emails are sent from 10.2; this parent only provides the shared send/retry helper they will call.

### 10.0 Household Pest Control — Clients & 6-Month Reminders (generated against SDD v1.0)
> v1 scope is intake (8.0) plus reminders only. No household job-management UI beyond tracking last service date and emailing at 6 months. SMS is deferred.
- [ ] 10.1 Persist `household_clients` (name, contactEmail, contactPhone, address, lastServiceDate). Allow Ops/Admin to create/update a client and set `lastServiceDate` (including when converting a household RFQ/RFW).
- [ ] 10.2 Implement idempotent `POST /api/household/reminders/run`: select clients whose last service date is ≥ 6 months ago, create `household_reminders` if needed, send email via Resend only when `sentAt` is null, then set `sentAt`. Re-running the same day must not double-send.
- [ ] 10.3 Add `vercel.json` with a daily Cron invoking 10.2. The job is date-driven so a missed run self-corrects the next day (SDD §R).
- [ ] 10.4 Reminder email copy: service due / last service date / contact. Channel `email` only.

### 11.0 Observability, CI/CD, Tests & Production Config (generated against SDD v1.0)
> No GitHub Actions, tests, or `vercel.json` exist today. README still describes a frontend-only demo.
- [ ] 11.1 Confirm `audit_log` is written for readings, corrective actions, stock movements, SI edits, certification, and intake conversion; add any missing writers. This table is the durable compliance record (SDD §R).
- [ ] 11.2 GitHub Actions on every PR: typecheck, lint, Prisma schema validation (`prisma validate`), and tests. Vercel preview deploys remain on Git integration (SDD §E).
- [ ] 11.3 Establish a test runner and cover the correctness-critical paths: stock deduction transaction + insufficient-stock reject; reading status derivation at 600ppm; certify lock + sequential FCC number; reminder `sentAt` idempotency; verify payload is public-safe; middleware RBAC (client cannot adjust stock; unauthenticated cannot POST readings).
- [ ] 11.4 Rewrite `README.md` to match the SDD stack (Neon, Prisma, Neon Auth, Blob, Resend, Cron) and real install/dev/migrate commands. Retire “there is no backend” and the stale “QR codes are visual placeholders” note.
- [ ] 11.5 Document required Vercel env vars (Neon, Resend, Blob token, intake HMAC/API key). Confirm secrets are never committed.
- [ ] 11.6 Rate-limit `intake/website` and `verify/[certificateId]` if not fully done in 8.2 / 7.5.
- [ ] 11.7 Structured request logs on route handlers. Optional Sentry free-tier hookup as recommended in SDD §R (not a blocker).
- [ ] 11.8 Leave SDD open items unresolved in code until Ops confirms them: 600ppm instrument/unit; weekend/holiday skip; corrective-action taxonomy vs free text; un-actioned critical escalation; Date De-gassed vs aeration fields; Executive dashboard. Do not invent product answers here.

## Reactive Log
2026-09-11 — Pinned `prisma@6.7.0` (+ `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless@0.10.4`) after discovering pnpm resolved to the unstable `prisma@8.0.0-rc.13` RC which has a breaking CLI architecture change (`generate` command removed) requiring Node 22.18+ and a `prisma.config.ts`-based datasource instead of `schema.prisma url = env(...)`. Stable 6.7.0 is compatible with Node 22.13.0 and the standard `schema.prisma` pattern used in this codebase.
2026-09-16 — Auth flow hardened: public Sign Up UI removed from `/login` (enterprise invite-only model). Hardcoded `currentUser` mock (`Grace Phiri`) stripped from `components/topbar.tsx` and deleted from `lib/mock-data.ts`; replaced with real `useCurrentUser()` hook and a skeleton loader. Developer's own account escalated to `admin` role via one-off script. Tasks 2.1–2.4 marked complete. Remaining: 2.5 RBAC enforcement, 2.6 first-admin docs.
2026-09-21 — Completed Neon Auth → Better Auth cutover. Neon Auth packages, `/api/auth/sync`, and `/api/auth/me` removed. Better Auth Prisma adapter writes `users` / `sessions` / `accounts` / `verifications` directly; `role` is an additional field (`input: false`); public `sign-up/email` is disabled. Seed creates credential accounts (`accountId` = user id). Login verified: `POST /api/auth/sign-in/email` returns 200 with `role: admin`. Prisma Neon HTTP adapter used for DATABASE_URL (WebSocket Pool was dropping the connection string). First-admin path: `npx prisma db seed` (admin@primon.mw) or `tsx prisma/seed-admin.ts --email <email>`. Remaining: 2.5 permission matrix, 2.6 README-facing docs.
