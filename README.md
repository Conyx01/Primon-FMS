# Primon Fumigation Management System (FMS)

A full-stack application built for Primon Enterprises Limited to manage fumigation workflows, gas reading monitoring, certificate generation, public verification, website intake, and household pest control client tracking.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | Neon Serverless Postgres |
| ORM | Prisma 6.7 with `@prisma/adapter-neon` |
| Authentication | Better Auth (Prisma Adapter) |
| Package Manager | pnpm |
| Testing | Vitest |
| Deployment | Vercel |
| Cron jobs | Vercel Cron (`vercel.json`) |
| Email *(pending)* | Resend |

## Environment Variables

Create a `.env.local` file in the project root. **Never commit this file.**

```env
# ── Required ──────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://[user]:[password]@[neon-host]/neondb?sslmode=require"
BETTER_AUTH_SECRET="<output of: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\">"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ── Required on Vercel (set in project settings) ──────────────────────────────
# BETTER_AUTH_URL="https://primon-fms.vercel.app"
# NEXT_PUBLIC_APP_URL="https://primon-fms.vercel.app"

# ── Set when DNS is ready ─────────────────────────────────────────────────────
# NEXT_PUBLIC_VERIFY_ORIGIN="https://verify.primon.mw"
# (used to build the public QR verify URL on certified FCCs)

# ── Set when Resend account is configured (Phase 9/10) ───────────────────────
# RESEND_API_KEY="re_..."
# (household reminder emails + staff notifications via email)
```

> **Secrets that are NOT needed** (removed from earlier design):
> - `INTAKE_API_KEY` — the Primon website is static HTML/CSS; the intake endpoint
>   is public and protected by rate limiting + mandatory Ops review instead.

## Getting Started (Local Development)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Apply migrations & generate Prisma Client

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

### 3. Seed the database

Populates fumigants, formulations, stock levels, and the initial set of users
(including an Admin):

```bash
pnpm exec prisma db seed
```

Default seed credentials (see `prisma/seed.ts`):
- **Admin:** `admin@primon.mw` / `Admin@Primon2026!`
- **Ops Manager / Supervisor / Client:** `Primon@2026!`

> Public sign-up is **disabled**. New users must be created by an Admin via the
> seed script or a one-off invite flow.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Project Structure

```
app/
  page.tsx                          Landing page
  login/page.tsx                    Sign-in page
  api/
    auth/[...all]/                  Better Auth handler
    work-orders/                    Work order CRUD
    fccs/[id]/                      FCC lifecycle (SI, fumigation, certify…)
    readings/                       Gas reading entry + corrective actions
    stock/                          Inventory & stock movements
    intake/
      website/                      Public intake endpoint (POST)
      pending/[id]/convert|reject   Ops review actions
    household/
      clients/                      Household client CRUD
      reminders/run                 Daily cron — sends 6-month reminder emails
    notifications/                  In-app notification feed
    verify/[certificateId]/         Public certificate verification
  dashboard/                        Internal app (Ops Manager / Admin / Supervisor)
  portal/                           Client portal
  verify/[certificateId]/           Public verify page
  fcc/[certificateId]/              Alias for verify page
components/                         Shared UI components
lib/
  auth/                             Better Auth server/client config + session helper
  hooks/                            React hooks (useNotifications, …)
  prisma.ts                         Prisma client singleton
  rate-limit.ts                     In-memory rate limiter
  readings.ts                       deriveReadingStatus + date helpers
  verify-url.ts                     Certificate verification URL builder
prisma/
  schema.prisma                     Database schema (all 18 models)
  migrations/                       Applied Prisma migrations
  seed.ts                           Reference data + demo users
__tests__/                          Vitest unit tests
.github/workflows/ci.yml            GitHub Actions: typecheck, lint, validate, test
vercel.json                         Cron schedule for household reminders
```

## Deployment (Vercel)

The `package.json` build script runs migrations automatically on deploy:

```
"build": "prisma generate && prisma migrate deploy && next build"
```

Set all environment variables in **Vercel → Project → Settings → Environment Variables**
before the first deployment. Vercel preview deploys run on every PR via Git integration.

## Running Tests

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
```

Tests cover: 600 ppm reading status boundary, rate limiter bucket logic, sequential
FCC / WO number generation, and intake pre-fill field inference.

## Pending (awaiting Primon credentials)

| Item | Blocker |
|---|---|
| Phase 9.2–9.7 — email notifications | `RESEND_API_KEY` + verified sending domain |
| Phase 10.2/10.4 — household reminder emails | Same |
| `NEXT_PUBLIC_VERIFY_ORIGIN` | `verify.primon.mw` DNS delegation |
| Executive dashboard | SDD open item — Ops decision needed |
| Weekend/holiday skip for gas reading dates | SDD open item |
