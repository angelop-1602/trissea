# Runbooks

## 1) Auth Outage (OTP or Session Failures)

1. Check Supabase project status and auth logs.
2. Verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Inspect API error rate for:
   - `/api/auth/sms/send`
   - `/api/auth/sms/verify`
4. Temporarily increase visibility on `AUTH_UNAVAILABLE` and `RATE_LIMITED` logs.
5. If provider outage confirmed, notify users and pause OTP retries.

## 2) Booking 5xx Spike

1. Filter logs by `requestId` and `route=/api/bookings/*`.
2. Check Prisma connectivity and migration drift.
3. Verify recent deploy included `prisma generate` and `prisma migrate deploy`.
4. Roll back release if spike started after deploy.

## 3) Realtime Degradation (SSE disconnect/reconnect storm)

1. Inspect `/api/realtime/stream` logs for `realtime.supabase.*` warnings.
2. Confirm Supabase Realtime status.
3. Validate client reconnection behavior from browser network traces.
4. Keep fallback polling enabled on critical pages until stream stabilizes.

## 4) Driver Presence Failures

1. Check `/api/bookings/driver/presence` status and 5xx rate.
2. Verify `DriverPresence` table exists and matches Prisma schema.
3. Confirm migration `add_driver_presence` and `phone_e164_identity_merge` are applied.
4. Validate geolocation permissions on driver clients.

## 5) Migration Rollback Drill

1. Backup production DB.
2. Run migration in staging and verify:
   - User identity mapping
   - Driver presence updates
   - Booking create/cancel/transition
3. If rollback needed, deploy previous app release and restore DB snapshot.
