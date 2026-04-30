# Tenant Onboarding

## Inputs Required

1. Province selection from PSGC
2. Branding values (optional): logo, primary color, accent color
3. Admin email domain configuration (`ADMIN_EMAIL` env, domain part is reused)

## Steps

1. Superadmin selects a province in tenant creation.
2. System creates tenant row with PSGC metadata:
   - `psgcCode`
   - `psgcType`
   - `provinceCode`
   - `regionCode`
   - `regionName`
   - `logo` (default: `/trissea-logo.png`)
3. System provisions tenant admin account:
   - `role=admin`
   - `tenantId=<created tenant>`
   - email format: `admin.<province-slug>.<psgcCode>@<admin-domain>`
   - temporary password: `trissea@YYYY`
   - `mustResetPassword=true`
4. Tenant admin seeds/configures TODA terminals for the tenant.
5. Validate tenant isolation by accessing booking APIs with a non-tenant user.
6. Confirm auth login binds to the canonical user identity.
