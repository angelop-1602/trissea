# TRISSEA PWA

Production-focused TRISSEA platform for Tuguegarao City tricycle booking, driver operations, and TODA queue work built with Next.js, Supabase, and Prisma.

## Stack

- Next.js App Router
- Supabase Auth + Postgres + Realtime
- Prisma ORM
- MapLibre/MapCN UI components for booking maps

## Roles

- Passenger
- Driver
- Admin (Tenant Admin)
- Superadmin

## Current Architecture

- Tenancy:
  - Province-based tenant mapping using PSGC metadata (`psgcCode`, `provinceCode`, `regionCode`, `regionName`)
  - One tenant per province
  - Tenant logo defaults to `/trissea-logo.png`
  - Passengers are global users (`tenantId = null`)
- Auth:
  - SMS OTP via Supabase (`/api/auth/sms/send`, `/api/auth/sms/verify`)
  - Signup supports passenger (global) and driver (province-selected tenant mapping)
  - Email + password login for admin/superadmin (`/api/auth/email/login`)
  - SSR-safe session checks through Supabase server client utilities
  - Route protection via `proxy.ts`
- Booking:
  - On-demand quote/create/cancel/transition
  - Driver presence heartbeat and nearest assignment
  - TODA queue reservation/dispatch/complete with FIFO compaction
- Realtime:
  - SSE relay endpoint at `/api/realtime/stream`
  - Internal event bus + Supabase postgres change relay

## API Contracts

Booking and auth mutation endpoints use:

- Success: `{ "data": ..., "meta"?: ... }`
- Error: `{ "error": string, "code": string, "requestId": string }`
- `x-request-id` response header is returned on API responses.
- Rate limited responses return `429` and `Retry-After`.

See [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) for details.

## Local Setup

1. Install dependencies

```bash
npm ci
```

2. Configure env

```bash
cp .env.example .env
```

3. Generate Prisma client and run migrations

```bash
npm run db:generate
npm run db:migrate
```

4. Seed sample data

```bash
npm run db:seed
```

5. Start dev server

```bash
npm run dev
```

## Production Notes

- Use `.env.production.example` as baseline.
- Optional distributed rate-limit support: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- Run `prisma migrate deploy` during deploy.
- CI workflow is at `.github/workflows/ci.yml`.
- Operational runbooks are in [docs/RUNBOOKS.md](docs/RUNBOOKS.md).
- Soft-launch SLO/rollout guide: [docs/SOFT_LAUNCH_RUNBOOK.md](docs/SOFT_LAUNCH_RUNBOOK.md).
