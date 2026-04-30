# Role Permission Matrix

## Passenger

- Global account (`tenantId = null`)
- On-demand quote/create
- Cancel own ride before start (`searching|matched|en_route`)
- View own active ride
- Create/cancel own TODA reservations while `confirmed`

## Driver

- Update own presence heartbeat
- View own active/assigned rides
- Transition assigned ride only:
  - `matched -> en_route`
  - `en_route -> arrived`
  - `arrived -> in_trip`
  - `in_trip -> completed`
  - `matched|en_route|arrived -> cancelled`
- TODA queue dispatch/complete operations

## Admin

- Tenant-level management dashboards
- No passenger/driver booking mutation impersonation

## Superadmin

- Cross-tenant platform management
- Province-based tenant governance (PSGC)

## Shared Rules

- Tenant isolation enforced on booking operations.
- Unauthorized cross-tenant access returns `403`.
