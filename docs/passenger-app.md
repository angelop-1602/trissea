# Passenger App Architecture

## Canonical passenger routes

- `/passenger/home`
- `/passenger/on-demand`
- `/passenger/toda`
- `/passenger/activity`
- `/passenger/account`

Compatibility routes that still exist:

- `/passenger/todo` redirects to `/passenger/toda`
- `/passenger/history` redirects to `/passenger/activity`

## Passenger shell

Passenger pages use a dedicated mobile shell through `PassengerAppShell`.

Core shell rules:

- top-right avatar opens the Account area
- bottom navigation stays focused on primary passenger tasks only
- safe-area padding is applied for mobile and PWA use
- passenger pages do not share the driver shell

## Primary passenger information architecture

### Home

- live ride state
- live TODA reservation state
- nearest TODA context
- next actions

### Book

- on-demand ride flow
- map-first booking
- bottom-sheet controls

### TODA

- nearest terminal
- terminal browsing
- reservation creation and management

### Activity

- `Trips` tab
- `Reservations` tab
- active / completed / cancelled filtering

### Account

- Profile
- Emergency Contact
- Settings
- Help & Support
- Logout

## Passenger terminology rules

- use `TODA` in passenger-facing labels
- use `Ride` for booking and live on-demand flow
- use `Trips` for ride records inside Activity
- keep `Reservations` separate from on-demand rides
- use `Account` for the top-level passenger account hub
- use `Profile` only for passenger identity editing

## Real account data supported today

Editable:

- `name`
- `email`
- `emergencyContactName`
- `emergencyContactPhone`

Read-only:

- `phone`

Theme support:

- `system`
- `light`
- `dark`

Theme mode is browser-local through the existing `next-themes` setup.

## Explicitly unsupported passenger surfaces

- wallet or payment management
- saved places
- ratings and reviews
- live chat support
- contact-driver actions
