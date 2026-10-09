# Primon Fumigation Management System (FMS) Workstream

This file combines the planned development roadmap and the reactive work log (fixes and debug sessions). It is managed by `@tasklist` (Planned Roadmap section only) and `@intake` (Reactive Log section only — `@tasklist` never writes here). It does not carry its own version number; git history and the `[x]` markers are sufficient. The SDD (`/Docs/Primon_FMS_System_Design_Document.md`) is versioned and is the contract this roadmap implements.

**v1 ship status (2026-10-09):** The industrial FCC product is complete for production use: Neon/Prisma, Better Auth + RBAC, work orders, stock, SI + description + deduction, Day 0 (≥16°C) + 6-day monitor (Sunday skip), close-out, certify (`FCC-PE-YYYY-######`), QR/PDF, public verify, website intake, Users/invites, operational Resend email (critical / certified / intake / low stock), client portal SI edit. **Parked:** household 6-month reminder send (10.2 / 10.4). **Deferred / ops:** Vercel Blob PDFs, `verify.primon.mw`, Executive dashboard, public-holiday date editor, Sentry.

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
- [x] 1.7 Optional local-only seed of the reviewed sample FCC (`FCC-PE-2026-000512` / Alliance One) on a non-production Neon branch so UI work has a realistic row. Do not seed production.

### 2.0 Authentication & Role-Based Access (generated against SDD v1.0)
> Must land before any mutating API in 3.0+. Auth is Better Auth (Prisma adapter) writing directly to Neon Postgres — not Neon Auth. `RoleSwitcher` is a no-op.
- [x] 2.1 Integrate Better Auth and mount its handlers under `app/api/auth/[...all]` (SDD §A.5 route tree; Neon Auth was abandoned due to frontend user-sync races).
- [x] 2.2 Persist application `users` (id, name, email, role, createdAt) against Auth identities. Role enum: `supervisor` | `ops_manager` | `admin` | `client` | `executive`. Users UI, invite tokens, deactivate, forgot-password added later.
- [x] 2.3 Add `middleware.ts` that requires a Better Auth session on `/dashboard` and `/portal`. Public routes: login/auth, invite, forgot-password, `POST /api/intake/website`, `GET /api/verify/[certificateId]` (and the verify page). `/` redirects to `/login` (marketing landing removed).
- [x] 2.4 Replace `/login` role-card sign-in with real credentials. `RoleSwitcher` returns null. Auth shell: navy + white `Primon-logo.png`, Magic UI particles/grid, blue border-beam card.
- [x] 2.5 Enforce the v1 permission matrix: Supervisor — gas-reading monitor + reading entry; Ops Manager — work orders, FCC lifecycle, certify, intake review; Admin — all Ops plus stock adjust; Client — own FCCs in `/portal` only; Executive — role exists, no dashboard.
- [x] 2.6 Document how the first Admin user is created (invite / seed) so 4.2 is not blocked on an empty `users` table.

### 3.0 Work Order Management (generated against SDD v1.0)
> Screens already exist at `/dashboard` and `/dashboard/work-orders/new`. This parent adds the SDD APIs, search/filter, header metadata, and stops the demo from generating 6-day slots at create time.
- [x] 3.1 Implement `GET` / `POST` `app/api/work-orders/route.ts`: list/search and create. Filter by code, client, crop type, and FCC/work-order status (SDD §M.1).
- [x] 3.2 Implement `GET` / `PATCH` `app/api/work-orders/[id]/route.ts`. After first attach, `clientId` cannot be changed (409).
- [x] 3.3 Auto-generate `WO-YYYY-#####` sequentially per year. Accept an externally supplied unique code; set `source` to `client_supplied` | `auto_generated` | `website`.
- [x] 3.4 Collect and persist optional header metadata on create/edit: Sales Order No., Shipment No., Delivery No. Add `scale` value `household` alongside `industrial` | `smallholder`.
- [x] 3.5 Wire the dashboard active-work-order table to `GET /api/work-orders` and add search/filter controls. KPI cards from the API.
- [x] 3.6 Restrict the new-work-order wizard step 0 to work-order identity only. Do not insert `gas_readings` on create. Invite fields hide once an existing client is selected.

### 4.0 Inventory, Formulations & Stock Movements (generated against SDD v1.0)
> `/dashboard/inventory` already shows on-hand levels. SDD requires Admin-only adjustments, an append-only movement log, and `quantityOnHand` as a maintained aggregate.
- [x] 4.1 Implement `GET /api/stock` returning each formulation’s on-hand quantity, threshold, fumigant, crop type, and unit.
- [x] 4.2 Implement `POST /api/stock/adjust` (Admin only): wrap `stock_movements` insert + `stock_levels.quantityOnHand` update in one transaction. Require a note. Never allow negative on-hand.
- [x] 4.3 Rewrite the inventory page: Admin-only mutation, custom quantity, note field, movement history. (Nav is Admin-only; supervisors stay on monitor.)
- [x] 4.4 Drive formulation dropdowns from live stock (including `cropType = both`).
- [x] 4.5 Surface low/zero-stock on the dashboard from API data. Enqueue Admin notification on crossing threshold (wired in 9.6).
- [x] 4.6 Write `audit_log` rows for every stock adjustment.

### 5.0 FCC Draft, Shipping Instructions & Fumigation Description (generated against SDD v1.0)
- [x] 5.1 Implement `GET /api/fccs/[id]` returning the FCC with SI, description, readings, close-out, and signatures.
- [x] 5.2 Implement `PATCH /api/fccs/[id]/si`: client (own FCC) and Ops/Admin may edit until locked or certified. Fumigation Contractor pre-filled to Primon Enterprises Limited.
- [x] 5.3 Scope `/portal` to the authenticated client’s work orders by `clientId`. Portal SI form until certification; sheet read-only after.
- [x] 5.4 Implement `POST`/`PATCH /api/fccs/[id]/fumigation-description` with transactional stock deduction and insufficient-stock reject. Set FCC `in_progress` when description is complete.
- [x] 5.5 Allow SI to remain incomplete when description is saved. SI completeness must not block fumigation or readings.
- [x] 5.6 Wire wizard steps 1–2 and portal SI editor to these APIs.
- [x] 5.7 Show Relative Humidity on the certificate 6-day table.
- [x] 5.8 Write `audit_log` diffs for SI and fumigation-description writes.

### 6.0 Gas-Reading Monitor, Flagging & Close-Out (generated against SDD v1.0)
- [x] 6.1 Date Fumigant Placed inserts Day 0 plus days 1–6. **Sundays skipped** (confirmed vs Primon paper FCC). Public holidays are not skipped in code (no holiday UI). Days 1–6 blocked until Day 0 temps are saved and product temp ≥ 16°C. Day 0 may be updated while days 1–6 are still pending.
- [x] 6.2 `POST /api/readings`: numeric Airspace and Probe/Case; temps and RH optional. Store `status` (`compliant` if both ≥ 600ppm, `critical` if either < 600). Persist `enteredBy` / `enteredAt` from the session.
- [x] 6.3 Critical: set FCC `flagged`, enqueue Ops/Admin in-app + email (9.3). Keep the day red until a corrective action is logged.
- [x] 6.4 `POST /api/readings/[id]/corrective-action`: session actor. Set day to `action_taken`. When no days remain `critical`, FCC to `under_review` or `in_progress`.
- [x] 6.5 Close-out form for Aeration Began, Aeration Completed, Duration / Total Hours Under Gas. Not auto-stamped in `certify()`. Save close-out stays visible so aeration can be corrected.
- [x] 6.6 Wire `/dashboard/monitor` and `/dashboard/monitor/[id]` to the APIs. Sequential next-pending-day UX.
- [x] 6.7 Block certification until all six days are `compliant` or `action_taken` **and** close-out is recorded. `audit_log` for readings and corrective actions.

### 7.0 Certification, Signatures, QR, PDF & Public Verify (generated against SDD v1.0)
- [x] 7.1 Certification UI for Supervising Fumigator, For the Supplier, Certifying Officer. Persist `signatures`. System timestamp stands in for wet signature.
- [x] 7.2 `POST /api/fccs/[id]/certify` in one transaction: three signers, six resolved days, close-out; `certified`; lock SI; sequential `FCC-PE-YYYY-######`.
- [x] 7.3 QR payload is `{NEXT_PUBLIC_APP_URL}/verify/{FCC-PE-…}` until `NEXT_PUBLIC_VERIFY_ORIGIN` is set.
- [x] 7.4 Certified FCC PDF client-side (html2canvas/jsPDF) only when `status = certified`. Blob PDF deferred.
- [x] 7.5 Public `GET /api/verify/[certificateId]` (rate-limited). Pages `/verify/[certificateId]` and `/fcc/[certificateId]`.
- [x] 7.6 Gate PDF buttons on `certified`.
- [x] 7.7 In-app + email certified notifications (9.4). `audit_log` for certification.

### 8.0 Public Website Intake (generated against SDD v1.0)
- [x] 8.1 `POST /api/intake/website`: public (no API key; static Primon site). Payload validation; `pending_submissions`; idempotent `idempotencyKey`.
- [x] 8.2 Rate-limit 10 req/60 s per IP.
- [x] 8.3 `POST /api/intake/pending/[id]/convert` after wizard creates the WO (`source = website`).
- [x] 8.4 Reject (optional merge-as-duplicate); row never deleted.
- [x] 8.5 `/dashboard/intake` live API; convert → wizard `?fromSubmission=<id>`.
- [x] 8.6 In-app + email Ops/Admin on every new submission (9.5).

### 9.0 Notifications (in-app + Resend) (generated against SDD v1.0)
- [x] 9.1 Notifications table + topbar unread bell.
- [x] 9.2 Resend installed; `RESEND_API_KEY` / `EMAIL_FROM`; `sendTransactionalEmail` with one retry; never fails the originating transaction. Domain `mail.primonenterprises.com`. Invite + password-reset use the same helper.
- [x] 9.3 Critical gas reading: in-app then email to active Ops Manager + Admin.
- [x] 9.4 FCC certified: in-app Ops/Admin/client; email attached client + Ops Manager (includes verify URL).
- [x] 9.5 New website submission: in-app + email Ops/Admin (not on duplicate idempotency).
- [x] 9.6 Low/zero stock: in-app + email Admin on threshold cross or zero.
- [x] 9.7 Shared helper exists. Household send (10.2) is parked and does not call it yet.

### 10.0 Household Pest Control — Clients & 6-Month Reminders (generated against SDD v1.0)
> v1 ship: client tracking UI only. Reminder emails parked. SMS deferred.
- [x] 10.1 Persist `household_clients`. Ops/Admin CRUD + last service date. RFQ convert does not auto-create a household row.
- [ ] 10.2 Idempotent `POST /api/household/reminders/run` — **parked**. Stub: 501 without key; `{ sent: 0 }` with key; no DB writes.
- [x] 10.3 `vercel.json` daily cron at 07:00 UTC hitting 10.2 (currently the stub).
- [ ] 10.4 Reminder email copy — **parked** with 10.2.

### 11.0 Observability, CI/CD, Tests & Production Config (generated against SDD v1.0)
- [x] 11.1 `audit_log` for readings, corrective actions, stock, SI, certification, intake conversion.
- [x] 11.2 GitHub Actions: typecheck, lint, `prisma validate`, tests.
- [x] 11.3 Vitest unit tests (600ppm, rate-limit, FCC/WO number format, intake prefill, Day 0 16°C gate). Not full integration coverage of stock/certify/RBAC as originally worded.
- [x] 11.4 README rewritten for Next/Prisma/Neon/Better Auth (not Neon Auth).
- [x] 11.5 Vercel env vars documented. No `INTAKE_API_KEY`. Secrets not committed.
- [x] 11.6 Rate-limit intake and verify.
- [x] 11.7 `console.error` on handlers. Sentry optional, not hooked.
- [x] 11.8 Remaining SDD open items: 600ppm instrument/unit; public-holiday skip (Sunday skip **confirmed**); corrective-action taxonomy; un-actioned critical escalation; Date De-gassed vs aeration; Executive dashboard.

## Reactive Log

2026-09-11 — Pinned `prisma@6.7.0` after pnpm resolved an unstable Prisma 8 RC.
2026-09-16 — Public sign-up removed; `useCurrentUser()`; admin seed path.
2026-09-21 — Neon Auth → Better Auth cutover.
2026-09-23 — RBAC in middleware + sidebar. README + first-admin docs. Phase 2.0 closed. Phase 3.0 work orders complete.
2026-09-24 — Phase 4.0 stock + Phase 5.0 FCC SI/description complete.
2026-09-25 — Neon adapter fix; Phase 6.0 monitor; Phase 7.0 certify/verify; Phase 8.0 intake (later: no intake API key); 9.1 / 10.1 / 10.3 / 11.0 without Resend operational mail.
2026-10-09 — Operational Resend: critical, certified, intake, low-stock (post-commit; invite/reset already live). Day 0 ≥ 16°C gate; portal SI editor; client attach locked after first save; wizard invite hidden when client selected. Auth visual: white `Primon-logo.png` on navy, particles, grid, blue border-beam card. Marketing landing purged; `/` → `/login`. Sunday skip confirmed vs paper FCC (not a bug). Household reminder send still parked (10.2 / 10.4). v1 industrial FCC considered complete for ship.
