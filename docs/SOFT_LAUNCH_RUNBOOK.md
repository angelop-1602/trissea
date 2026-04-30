# Soft Launch Runbook

## 1. Launch Scope

- Pilot one tenant/city first.
- Keep launch window at 48 hours before expanding.
- Expansion requires no P0/P1 incidents and all SLOs meeting targets.

## 2. SLOs and Alerts

### Booking

- SLO: booking success rate >= 99%.
- Alert: trigger when booking success drops below 98% over 15 minutes.

### OTP Auth

- SLO: OTP send+verify success >= 99%.
- Alert: trigger when `AUTH_UNAVAILABLE` exceeds 1% of auth attempts over 15 minutes.

### Realtime

- SLO: SSE disconnect/reconnect error rate < 1%.
- Alert: trigger when `realtime.supabase.channel_error` appears > 20 times in 10 minutes.

### Driver Presence

- SLO: driver presence update success >= 99.5%.
- Alert: trigger when `/api/bookings/driver/presence` 5xx exceeds 0.5% over 15 minutes.

## 3. Rollout Sequence

1. Deploy release candidate to production behind pilot tenant flag.
2. Run smoke checks:
   - Passenger login -> quote -> booking -> cancel.
   - Driver online -> assigned ride -> transition.
   - Admin dashboard -> terminals/drivers/rides pages.
3. Monitor for 48 hours.
4. If all SLOs are healthy and no P0/P1 incidents, expand to next tenant/city.

## 4. Rollback Decision Thresholds

Rollback immediately when one or more conditions are true:

- Booking success < 95% for 10 minutes.
- OTP auth failure > 5% for 10 minutes.
- Any auth bypass or data leakage incident.
- Critical admin/driver dashboard outage.

## 5. Incident Ownership

- Incident Commander: release owner on-call.
- Backend Owner: API and auth triage.
- Frontend Owner: client UX and retry-state triage.
- Communications Owner: user/status update every 30 minutes during incident.

## 6. Rollback Procedure

1. Announce rollback start in incident channel.
2. Deploy previous stable app release.
3. Verify critical endpoints:
   - `/api/auth/sms/send`
   - `/api/auth/sms/verify`
   - `/api/bookings/on-demand`
   - `/api/dashboard/admin/overview`
4. Validate auth and booking smoke checks on pilot tenant.
5. Close incident only after 30 minutes stable metrics.
