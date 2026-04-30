# Modular Platform Context

## Purpose

Read this file before making architecture changes that affect booking flows, navigation, shared domain logic, tenant scoping, or future transport expansion.

This is the canonical context file for the platform's modular direction. It explains:

- what the system is today
- what the target multi-module model is
- what should stay shared
- what should remain tricycle-specific
- how future jeepney work should be added without breaking the live system

Use this file as both an architecture reference and an update playbook.

## Current State

The system is live today as a tricycle-first booking platform.

Current live product shape:

- passenger flows are centered on on-demand rides and TODA reservations
- driver workflows are built around tricycle/TODA operations
- admin workflows are tenant-scoped and operationally tied to the current tricycle domain
- shared data models, APIs, routes, and UI copy still contain tricycle-specific assumptions

Important reality:

- multi-module support is not implemented yet
- tricycle is the only live transport module
- jeepney is the next planned module
- existing tricycle routes, APIs, and business rules remain the live system and must keep working

This means future changes must prepare for modularity without rewriting the current product in one step.

## Target Model

The intended direction is a multi-module mobility platform.

Target platform shape:

- shared platform layer for auth, tenant scoping, role gating, shared navigation rules, common layouts, shared reporting patterns, and shared account/session behavior
- module layer for transport-specific implementations
- tenant-enabled modules so a tenant can run one or more transport modules
- module hub entry when a tenant has multiple modules enabled

Target examples:

- `tricycle` is the first live transport module
- `jeepney` is the next planned transport module
- future modules should plug into the platform through the same shared/module boundary

Planned multi-module behavior:

- if a tenant has one module enabled, the app can open the tenant default module directly
- if a tenant has multiple modules enabled, the app should show a module hub and then route into the chosen module

## Canonical Terms

Use these terms consistently in future documentation and implementation work.

- `shared platform`: code and UX that should work across transport modules
- `module`: a transport-specific product slice with its own routes, APIs, domain logic, and UI behavior
- `tricycle module`: the current live module built around on-demand rides and TODA reservations
- `jeepney module`: the planned module for scheduled route-based jeepney booking
- `tenant-enabled module`: a transport module enabled for a specific tenant
- `module hub`: the shared entry view that lets a user choose between enabled modules
- `shared services`: tenant/session/auth/navigation/reporting or other logic that is not transport-specific
- `module-specific services`: logic that belongs to one transport mode only

## Boundary Rules

Use these rules when deciding where a change belongs.

### Shared platform belongs here

Put logic in shared areas when it applies across transport modules, such as:

- auth and session handling
- tenant resolution and tenant scoping
- role-based access rules
- shared account/profile patterns
- module registry and module enablement
- shell-level navigation rules
- cross-module reporting and governance patterns
- shared audit, logging, and error envelope conventions

### Tricycle module belongs here

Keep logic in tricycle-specific areas when it depends on the current tricycle domain, such as:

- on-demand ride lifecycle and dispatch
- TODA terminal logic
- reservation queue behavior
- tricycle-specific driver operations
- copy that explicitly refers to TODA or tricycle workflows

### Future jeepney module belongs here

Create jeepney-specific areas when the feature is tied to the jeepney domain, such as:

- route and stop management
- departure scheduling
- seat-capacity logic
- boarding and dropoff stop selection
- manifest operations
- jeepney-specific admin, driver, and passenger flows

## Route and API Direction

The project should move toward shared route roots plus module-specific route groups.

Target route direction:

- shared entry and shell behavior stays role-based
- module-specific passenger flows should eventually live under paths like `/passenger/tricycle/*` and `/passenger/jeepney/*`
- module-specific admin flows should eventually live under paths like `/admin/tricycle/*` and `/admin/jeepney/*`
- module-specific driver flows should eventually live under paths like `/driver/tricycle/*` and `/driver/jeepney/*`

Compatibility rule:

- current tricycle routes remain supported during the transition
- existing routes such as `/passenger/on-demand` and `/passenger/toda` should be treated as live compatibility routes until the modular structure is fully introduced

API grouping direction:

- shared platform APIs should stay transport-neutral when possible
- tricycle APIs remain under the current booking/admin structure until extracted incrementally
- future jeepney APIs should get their own grouped endpoints rather than being forced into tricycle-specific handlers

Practical guidance:

- if an API change is only for TODA, rides, or terminal dispatch, keep it in the tricycle domain
- if an API change is about module discovery, module enablement, shared auth context, or cross-module navigation, design it as shared platform behavior
- if an API change is for route stops, departures, manifests, or seat bookings, design it as jeepney module work

## Data Model Direction

Do not try to make the current tricycle domain models represent every transport mode.

Current rule:

- existing tricycle-oriented tables and concepts stay in place for now
- incremental modularization is preferred over high-risk table renames or big-bang migrations

Important design direction:

- current models like `Ride`, `Reservation`, and `TODATerminal` remain the live tricycle domain
- jeepney should get its own domain models instead of being squeezed into tricycle tables
- future module enablement should be represented separately from transport execution data

Do not do this:

- do not force jeepney booking into the current on-demand `Ride` lifecycle
- do not treat jeepney as only another `rideType` inside the existing tricycle flow
- do not overload TODA-specific models to represent jeepney routes or departures

Do this instead:

- keep tricycle data intact
- add shared module-enablement structures later
- add jeepney-specific tables later for stops, routes, departures, vehicles, and bookings

## Developer Update Playbook

Use this checklist before changing the current system.

### If you are changing shared behavior

Examples:

- auth/session payloads
- tenant scoping
- shell navigation
- role routing
- shared account patterns
- future module registry logic

Update approach:

1. check whether the behavior applies to more than one transport module
2. keep labels and naming transport-neutral
3. avoid importing tricycle-specific assumptions into shared helpers
4. preserve current tricycle behavior while preparing shared boundaries

### If you are changing tricycle behavior

Examples:

- on-demand ride booking
- TODA reservations
- terminal operations
- driver dispatch
- tricycle-specific passenger or driver copy

Update approach:

1. keep the change inside current tricycle routes, services, schemas, or UI areas
2. do not rename tricycle tables or APIs just to sound more generic
3. only extract shared logic when it is truly reusable across modules
4. preserve compatibility with the live passenger, driver, and admin flows

### If you are preparing future jeepney work

Examples:

- route-stop models
- departure scheduling
- seat-capacity logic
- jeepney admin CRUD
- jeepney passenger booking flow

Update approach:

1. build jeepney as a separate module domain
2. reuse shared platform patterns only where they are truly transport-neutral
3. avoid mutating tricycle-specific schemas to pretend they are universal
4. keep jeepney additions incremental and isolated from the live tricycle path

### If you are changing navigation or wording

Examples:

- dashboard labels
- role landing pages
- shared layout text
- module selection entrypoints

Update approach:

1. use neutral mobility language in shared surfaces
2. keep `TODA`, `tricycle`, and other transport-specific terms only inside the module they belong to
3. do not remove working tricycle wording from tricycle-specific pages
4. when in doubt, preserve live behavior first and neutralize only the shared layer

## Do / Don't Rules

### Do

- preserve tenant scoping everywhere
- preserve current live tricycle behavior unless the task explicitly changes it
- prefer incremental refactors over cross-project rewrites
- separate shared platform code from transport-specific code
- treat jeepney as a new module with its own domain
- keep compatibility paths in place during migration
- make shared naming neutral when the feature is cross-module

### Don't

- do not rewrite the whole booking system just to introduce modular language
- do not collapse tricycle and jeepney into one overloaded flow
- do not force jeepney logic into `Ride`, `Reservation`, or `TODATerminal`
- do not do big-bang renames of stable runtime tables only for terminology cleanup
- do not break existing passenger, driver, admin, or superadmin tricycle workflows while preparing modularity
- do not mix transport-specific copy into shared platform surfaces

## Implementation Roadmap Snapshot

This is the current high-level roadmap for modularization.

### Phase 1: Module foundation

- define shared module concepts and tenant-enabled modules
- extend shared session/context data with module information
- prepare a module hub entry pattern
- neutralize shared copy and shared navigation where appropriate

### Phase 2: Tricycle isolation

- treat the current tricycle system as one explicit module
- introduce clearer shared-vs-module boundaries
- keep old tricycle routes and APIs working through compatibility paths or redirects

### Phase 3: Jeepney admin setup

- add jeepney-specific domain models and admin CRUD
- prepare route-stop, vehicle, departure, and manifest management

### Phase 4: Jeepney passenger beta

- add passenger-facing jeepney browsing and booking
- keep tricycle flows intact while surfacing jeepney as a separate module

### Phase 5: Jeepney driver beta

- add driver-facing jeepney operations and departure lifecycle tools
- keep role sharing where useful, but gate module-specific actions correctly

## Quick Decision Guide

Use these fast rules when you are unsure where a change belongs.

- If the change affects auth, tenant scope, or shared role routing, treat it as shared platform work.
- If the change affects TODA, on-demand rides, dispatch, or current reservation logic, treat it as tricycle module work.
- If the change affects routes, stops, departures, segment capacity, or manifests, treat it as jeepney module work.
- If the change is a naming cleanup, only neutralize shared surfaces; keep transport-specific terms inside their transport module.

## Maintenance Reminder

Before implementing future modular work, read:

- this file for architecture direction
- `.codex/context/context.md` for general project implementation rules
- `.codex/context/context2.md` for passenger-specific constraints when the change touches passenger flows

When updating the modular architecture itself, update this file first so future developers and Codex sessions inherit the same decisions.
