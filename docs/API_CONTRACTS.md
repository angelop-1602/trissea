# API Contracts

## Standard Envelope

### Success

```json
{
  "data": {},
  "meta": {}
}
```

`meta` is optional.

### Error

```json
{
  "error": "Human readable message",
  "code": "STABLE_ERROR_CODE",
  "requestId": "uuid-or-forwarded-id"
}
```

## Headers

- `x-request-id`: correlation ID for tracing request logs.
- `Retry-After`: returned on `429 RATE_LIMITED`.

## Booking Error Codes

- `INVALID_REQUEST`
- `FORBIDDEN_ROLE`
- `TENANT_REQUIRED`
- `TENANT_SCOPE_VIOLATION`
- `TENANT_NOT_FOUND_FOR_PROVINCE`
- `PROVINCE_NOT_RESOLVED`
- `GEOCODE_UNAVAILABLE`
- `RIDE_NOT_FOUND`
- `RESERVATION_NOT_FOUND`
- `TERMINAL_NOT_FOUND`
- `INVALID_TRANSITION`
- `INVALID_ACTION`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `AUTH_UNAUTHORIZED`
- `AUTH_UNAVAILABLE`

## Backward Compatibility

Existing route paths are preserved:

- `/api/bookings/...`
- `/api/realtime/stream`
- `/api/auth/sms/send`
- `/api/auth/sms/verify`
- `/api/auth/email/login`
