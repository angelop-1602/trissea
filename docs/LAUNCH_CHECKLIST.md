# Launch Checklist

## Pre-Release

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `prisma migrate deploy` validated on staging

## Production Readiness

1. Environment variables set from `.env.production.example`
2. Supabase auth + DB connectivity verified
3. Rate limits confirmed for OTP + booking mutation endpoints
4. `x-request-id` visible in API responses and logs
5. SSE stream verified on `/api/realtime/stream`

## Internal Beta Exit

1. No P0/P1 auth or booking defects for 7 days
2. Booking success >= 99%
3. Driver presence error rate < 0.5%
4. Identity merge mismatches resolved

## Public Launch

1. CI pipeline green on release branch
2. Monitoring dashboards and alerts active
3. Rollback runbook validated
