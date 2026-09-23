# Primon Fumigation Management System (FMS)

A full-stack application built for Primon Enterprises Limited to manage fumigation workflows, gas reading monitoring, and certificate generation.

## Tech Stack
- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Neon Serverless Postgres
- **ORM:** Prisma Client with `@prisma/adapter-neon`
- **Authentication:** Better Auth (Prisma Adapter)
- **Deployment:** Vercel

## Getting Started (Local Development)

### 1. Environment Variables
Create a `.env.local` file in the root of the project with the following required variables:

```env
DATABASE_URL="postgresql://[user]:[password]@[neon-host]/neondb?sslmode=require"
BETTER_AUTH_SECRET="your-secure-random-string-here"
BETTER_AUTH_URL="http://localhost:3000"
```

### 2. Install & Migrate
```bash
# Install dependencies
npm install

# Generate Prisma Client and apply migrations to your database
npx prisma generate
npx prisma migrate deploy
```

### 3. Create the First Admin User
**Public sign-ups are disabled.** This application uses an enterprise invite/seeding model.
To populate the database with the initial set of reference users (including an Admin), run the database seed script:

```bash
npx prisma db seed
```
This script creates four users with standard demo credentials. Check `prisma/seed.ts` for the exact emails and passwords (default password is `Primon@2026!` and Admin is `Admin@Primon2026!`).

### 4. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in.

## Project Structure

```
app/
  page.tsx                     Landing page
  login/page.tsx               Sign-in page
  api/auth/[...all]/route.ts   Better Auth handler
  dashboard/                   Internal app (Ops Manager / Admin / Supervisor)
  portal/                      Client portal
  certificate/[id]/page.tsx    Standalone certificate view
components/                    Shared UI components
lib/                           Types, auth helpers, and Prisma client
prisma/                        Database schema, migrations, and seed scripts
```

## Deployment (Vercel CI/CD)
When deploying to Vercel, ensure you have set all Environment Variables in your Vercel project settings. 

The `package.json` build script is configured to automatically run database migrations during deployment:
`"build": "prisma generate && prisma migrate deploy && next build"`
