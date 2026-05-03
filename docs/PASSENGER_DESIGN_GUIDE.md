# TRISSEA Passenger Design Guide

This is the source of truth for designing and redesigning passenger-facing TRISSEA screens. Every passenger UI change should start here, then use `docs/passenger-app.md` for route structure, terminology, and supported product scope.

Last scanned: 2026-05-03

## Source Scan

This guide is derived from the current passenger home page and shared passenger primitives:

- `app/passenger/home/page.tsx`
- `components/passenger/passenger-app-shell.tsx`
- `components/passenger/passenger-topbar.tsx`
- `components/mobile-user-topbar.tsx`
- `components/bottom-nav.tsx`
- `components/passenger/passenger-surfaces.tsx`
- `components/passenger/account-section.tsx`
- `components/passenger/toda-terminals-page.tsx`
- `lib/passenger-navigation.tsx`
- `app/globals.css`
- `docs/passenger-app.md`

The home page is the visual reference. Other passenger pages should borrow its tokens, rhythm, panel language, icons, action hierarchy, and direct local copy without copying the exact hero layout unless the page needs a home-style introduction.

## Design North Star

TRISSEA passenger should feel local, practical, mobile-first, and reassuring. It is not a generic admin dashboard and it is not a marketing landing page. It should feel like a daily mobility companion for Tuguegarao passengers: fast to scan, clear under stress, bright enough to feel friendly, and structured enough to feel trustworthy.

Use these words as the north star:

- Local
- Helpful
- Tactile
- Clear
- Calm
- Ready

Avoid these directions:

- Corporate dashboard
- Decorative landing page
- Overly sparse wellness app
- Generic ride-hailing clone
- One-off green palettes outside the tenant theme
- Heavy gradients, blobs, or purely atmospheric imagery

## Required Design Workflow

Use this workflow for every passenger redesign:

1. Confirm the route belongs in the passenger app and check `docs/passenger-app.md` for terminology and support boundaries.
2. Identify the screen archetype from this guide: home, map-first, status list, settings form, module hub, or unavailable module.
3. Place the page in `PassengerAppShell` unless it is public auth or onboarding.
4. Choose one primary action and make it obvious above secondary actions.
5. Use passenger theme tokens, shared surfaces, Lucide icons, and real TRISSEA transport assets.
6. Design loading, empty, error, and active-state surfaces before considering the page done.
7. Check mobile at 375px first, then tablet and desktop.

Do not begin a redesign by inventing a new page frame. Start from the shell, topbar, bottom navigation, and surface recipes below.

## Product Principles

1. Put the next ride action first.
   Passenger screens should make the next useful action obvious: book, reserve, scan, view activity, or manage account.

2. Keep it mobile-native.
   Passenger UI is designed for phone and PWA use first. Desktop should center the same mobile surface with `max-w-screen-sm`, not become a wide dashboard.

3. Use real mobility context.
   Prefer terminal names, queue counts, ETA, route states, driver details, active ride status, and account data over decorative filler.

4. Make status visible.
   Active rides, reservations, queue position, availability, ETA, and errors should appear in compact, glanceable panels.

5. Keep the visual language tactile.
   The home page uses soft raised surfaces, rounded controls, compact stat strips, pill labels, and a physical-feeling primary action.

6. Preserve calm density.
   Passenger pages can show several pieces of information, but spacing, truncation, and hierarchy must keep them easy to scan.

7. Be honest about product boundaries.
   Do not design unsupported wallet, saved places, live chat, contact-driver, ratings marketplace, or payment flows unless the product scope changes.

## Theme Tokens

Always use theme tokens instead of hardcoded colors unless this guide is being intentionally updated.

| Role | Token | Default light value |
| --- | --- | --- |
| App background | `bg-background` | `#f5f9f7` |
| Primary text | `text-foreground` | `#0f1f16` |
| Muted text | `text-muted-foreground` | `#5b6b61` |
| Card surface | `bg-card` | `#ffffff` |
| Primary brand/action | `bg-primary`, `text-primary` | `#14622e` |
| Primary foreground | `text-primary-foreground` | `#ffffff` |
| Accent | `bg-accent`, `text-accent` | `#fecc04` |
| Accent foreground | `text-accent-foreground` | `#0f1f16` |
| Border | `border-border` | `#cddbd2` |
| Ring | `ring-ring` | `#14622e` |

Passenger pages must live inside the `theme-passenger` scope from `PassengerAppShell`. Tenant branding flows through `getTenantThemeVariables`, so new passenger UI should use `primary`, `accent`, `background`, `card`, `border`, `muted`, and semantic status tokens.

Use opacity variants for passenger surfaces:

- `border-primary/15` for primary-tinted panels.
- `border-border/60` to `border-border/70` for neutral page panels.
- `bg-primary/5` to `bg-primary/10` for selected, highlighted, or context surfaces.
- `bg-accent/[0.07]` to `bg-accent/[0.12]` for warm supporting cards.
- `bg-background/58` to `bg-background/88` for frosted passenger shell panels.
- `bg-card` for the strongest white content panels.
- `hover:bg-muted/35` for low-risk hover feedback.

Never replace the yellow accent with orange, beige, or another warm color. Never introduce a second dominant green scale beside the theme tokens.

## App Shell

Use `PassengerAppShell` for all authenticated passenger routes.

Default page frame:

```tsx
<PassengerAppShell title="Page title" topContext="Page">
  {children}
</PassengerAppShell>
```

Default shell behavior:

- Full-screen `theme-passenger` background.
- Subtle radial tint and dot texture behind content.
- Centered mobile content using `mx-auto w-full max-w-screen-sm`.
- Safe-area-aware bottom spacing for PWA use.
- Passenger-only bottom navigation.

Use `showHeader={false}` only for immersive pages with their own top context, such as Home and map-first booking.

Use `headerSurface="minimal"` when the page already has a strong hero or map surface directly below the topbar.

Use `contentClassName` sparingly and only to support a route-specific layout:

| Page type | Content rhythm |
| --- | --- |
| Standard page | `space-y-4 px-4 py-3` |
| Home-style dense page | `space-y-3 px-3.5` |
| Map-first page | `max-w-full px-0 py-0 space-y-0` |

## Navigation

Passenger bottom navigation is part of the design identity. Keep it consistent.

Primary nav items:

- Home or Modules
- Scan
- Book
- Activity
- TODA

Rules:

- The center `Book` action is the primary action and uses the raised diamond treatment.
- Do not add more than five bottom nav items.
- Labels should be one word when possible.
- Active items use `text-primary`, a soft primary icon background, and the small active dot.
- The bottom bar must keep safe-area padding with `env(safe-area-inset-bottom)`.
- Do not put secondary settings, help, or auth actions in the bottom nav.

## Topbar

Use `PassengerTopbar` through `PassengerAppShell` for most pages.

The passenger topbar should feel like a frosted mobile control:

- Sticky at the top.
- Rounded panel around `1.9rem`.
- `border-border/60`.
- `bg-background/72` with backdrop blur.
- Context pill with uppercase text and positive letter spacing.
- Account avatar on the right.

Use the account-area shield context only for account routes. Use the compass context for general passenger routes.

For most standard pages:

```tsx
<PassengerAppShell
  title="Activity"
  subtitle="Trips and reservations in one place."
  topContext="Activity"
  headerVariant="compact"
  headerSurface="minimal"
>
  {children}
</PassengerAppShell>
```

## Home Page Pattern

The home page defines the flagship passenger pattern:

1. Brand and city identity at the top.
2. Notification and account actions on the right.
3. Personalized greeting.
4. Two immediate actions: `Ride Now` and `Reserve`.
5. A strong booking panel with pickup, drop-off, terminal context, stats, and the main `Book Tricycle` CTA.
6. Small card grids for ride options.
7. Compact list surfaces for recent places or common destinations.

Home page design DNA:

- Brand lockup uses logo + uppercase city label + bold `TRISSEA`.
- Hero image uses `/mobile-hero-img.png` as a real product/service signal.
- Primary action is never buried below passive content.
- Booking panel is the strongest card on the page.
- Metric strip uses three compact facts: queue, available, ETA.
- Rows and cards truncate local names instead of wrapping into unstable layouts.

Use this pattern when a passenger page needs to combine identity, context, and action. Do not turn other pages into marketing hero sections.

## Screen Archetypes

### Home

Use for `/passenger/home`.

Structure:

- Custom hero with brand, greeting, and immediate actions.
- Active ride or reservation strip if present.
- Primary booking panel.
- Secondary ride option grid.
- Compact recent/common list.

Rules:

- Use `showHeader={false}`.
- Keep the booking panel above secondary sections.
- Use real transport images for the first viewport.
- Do not add broad marketing copy or feature explanations.

### Map-First Booking

Use for `/passenger/on-demand`.

Structure:

- Full-bleed map or map placeholder.
- Floating top controls if needed.
- Bottom sheet for pickup, drop-off, quote, active ride, and driver status.
- Sticky or bottom-aligned primary CTA.

Rules:

- Use `showHeader={false}` and `contentClassName="!max-w-full !space-y-0 !px-0 !py-0"`.
- Keep map and controls inside one full-height surface.
- Use bottom sheets instead of stacked page cards.
- Quote facts should use `PassengerMetricPill`.
- Active ride status should stay visible while the passenger follows the route.

### Status List

Use for `/passenger/activity`, active reservations, terminal lists, and history records.

Structure:

- Compact section title.
- Optional tabs or chips.
- One list surface with internal dividers.
- Rows with status badge, facts, and a small resume/manage action.

Rules:

- Use `divide-y divide-border/55` inside one rounded panel.
- Do not wrap every row in its own card.
- Keep each row scannable: title, metadata, status, facts, action.
- Empty states must route to the next useful action.

### TODA And Queue

Use for `/passenger/toda`.

Structure:

- Active reservation surface if present.
- Highlight panel for nearest TODA.
- Nearby terminal list.
- Selected terminal reservation panel.

Rules:

- Keep TODA reservations separate from on-demand rides.
- Use `TODA`, `Queue`, `Boarding`, and `Reservation` consistently.
- Surface distance, queue position, and boarding time as metric pills.
- Cancellation copy must explain when cancellation is unavailable.

### Account And Settings

Use for `/passenger/account` and nested account pages.

Structure:

- Account hero or section title.
- One rounded section per related group.
- Rows with icon, label, description, and chevron.
- Forms inside account-style panels.

Rules:

- Use `AccountSection`, `AccountRow`, and `AccountValueRow`.
- Keep settings honest: only show real app preferences.
- Use `Profile` only for identity editing.
- Use `Account` for the top-level hub.
- Read-only values should look calmer than editable controls.

### Module Hub And Unavailable Modules

Use for `/passenger/modules`, `/passenger/tricycle`, `/passenger/jeepney`, and future transport modules.

Structure:

- Highlight panel with current tenant or module context.
- Module cards or unavailable-state surfaces.
- Primary action for available module.
- Disabled or explanatory action for unavailable module.

Rules:

- Do not invent full flows for unavailable modules.
- Say what is prepared and what is not live yet.
- Link back to available transport options.
- Keep unsupported module copy short and transparent.

### Scan

Use for `/passenger/scan`.

Structure:

- Highlight panel with scan frame.
- Compact rows for what the scan will verify.
- Disabled or placeholder action until scanning is live.
- Route to booking as the alternate action.

Rules:

- The scan frame should be tactile and high contrast.
- Do not imply QR scanning is functional until implementation exists.
- Explain current readiness without turning the page into a spec document.

## Surfaces

Passenger surfaces should be soft, rounded, and compact.

| Surface | Use | Class direction |
| --- | --- | --- |
| Primary action panel | Booking, reservation, scan, active ride | `rounded-[1.35rem] border border-primary/15 bg-card shadow-sm` |
| App section panel | Account sections, activity lists, module panels | `rounded-[1.7rem]` to `rounded-[1.9rem] border border-border/60 bg-background/58` |
| Highlight panel | Nearest TODA, module hero, scan hero | `rounded-[2rem] border border-primary/15 bg-primary/[0.06]` |
| Compact list | Places, activity rows, settings rows | `overflow-hidden rounded-[1.15rem] border border-border/70 bg-card` |
| Metric pill | Counts and status facts | `rounded-[1.2rem] border border-border/45 bg-background/42 px-3 py-3` |
| Notice | Success, warning, contextual update | `rounded-[1.4rem] border border-primary/20 bg-primary/5 px-4 py-3` |
| Empty state | No trips, no reservations, unavailable modules | `rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-8 text-center` |

Avoid nested card stacks. If a panel contains repeated rows, use dividers inside one surface instead of wrapping every row in a separate card.

## Component Recipes

### Passenger Highlight Panel

Use for the first meaningful surface on standard pages:

```tsx
<section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/[0.06] px-4 py-5">
  <div className="space-y-1">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Context label</p>
    <h2 className="text-lg font-semibold tracking-tight">Primary page context</h2>
    <p className="text-sm text-muted-foreground">One short sentence with the useful status.</p>
  </div>
</section>
```

### Passenger List Panel

Use for terminals, activity records, account rows, and settings rows:

```tsx
<div className="divide-y divide-border/55 overflow-hidden rounded-[1.9rem] border border-border/60 bg-background/58">
  {rows.map((row) => (
    <div key={row.id} className="px-4 py-4">
      {row.content}
    </div>
  ))}
</div>
```

### Passenger Metric Pill

Use the shared primitive:

```tsx
<PassengerMetricPill label="ETA" value="4 min" />
```

Metric labels should be one or two words. Values should be short enough to scan in a three-column mobile grid.

### Passenger Row

Use this shape for any tappable row:

```tsx
<Link
  href="/passenger/on-demand"
  className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
    <Icon className="h-4 w-4" />
  </span>
  <span className="min-w-0 flex-1">
    <span className="block truncate text-sm font-semibold leading-tight">Row title</span>
    <span className="block truncate text-xs text-muted-foreground">Supporting detail</span>
  </span>
  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
</Link>
```

## Buttons And Actions

Passenger buttons should be obvious, thumb-friendly, and compact.

Primary CTA:

- Height: `h-11` or `h-12`.
- Shape: `rounded-[0.9rem]` to `rounded-full`.
- Color: `bg-primary text-primary-foreground`.
- Weight: `font-semibold`.
- Optional accent underside for flagship booking action: `shadow-[0_3px_0_var(--accent)]`.

Secondary CTA:

- Use `variant="outline"` or a custom outline with `border-primary/45 bg-white text-primary`.
- Keep it visually quieter than the primary CTA.

Ghost action:

- Use for low-risk row-level actions like `View Activity`, `Resume Trip`, or `View Terminal`.
- Keep height around `h-8` to `h-9` for compact list rows.

Icon buttons:

- Use circular `h-10 w-10` controls.
- Include `aria-label`.
- Use Lucide icons.
- Keep hover states color-based, not layout-shifting.

Button labels should use action verbs:

- Use: `Ride Now`, `Reserve`, `Book Tricycle`, `Book Ride`, `Save changes`, `Cancel ride`, `Open TODA`.
- Avoid: `Submit`, `OK`, `Click here`, `Proceed`.

## Typography

The passenger app uses the global sans stack from `--font-sans`.

Use this hierarchy:

| Element | Direction |
| --- | --- |
| App wordmark | Uppercase, very bold, primary, accent text shadow when used as brand identity |
| Page title | `text-2xl` to mobile clamp around `2.05rem` to `2.65rem`, `font-semibold`, tight line height |
| Section title | `text-sm` to `text-lg`, `font-semibold`, `tracking-tight` |
| Card title | `text-sm` to `text-base`, `font-semibold` |
| Body | `text-sm` or `text-[0.9rem]`, medium only when it improves scanability |
| Metadata | `text-xs text-muted-foreground` |
| Micro labels | `text-[9px]` to `text-[11px]`, uppercase only for labels, positive tracking |

Use sentence case for normal UI text. Reserve uppercase for brand, city labels, status chips, and tiny metadata labels.

Do not add negative letter spacing to new UI. Use normal tracking for most text and positive tracking for uppercase micro labels.

## Icons And Imagery

Use `lucide-react` for UI icons. Keep icon sizes consistent:

- `h-3.5 w-3.5` for context pills and metric inline icons.
- `h-4 w-4` for row icons and button icons.
- `h-5 w-5` for navigation.
- `h-6 w-6` to `h-7 w-7` for pickup/drop-off markers.

Use real TRISSEA assets for transport and brand moments:

- `/trissea-logo.png`
- `/mobile-hero-img.png`
- `/mobile-landing-hero-tricycle.png`

Images should explain the service or mode. Avoid generic photos, decorative blobs, emoji icons, and invented transport illustrations when existing assets work.

For Next.js implementation:

- Use `next/image` for app imagery.
- Use `fill` inside a relatively positioned parent for responsive images.
- Use empty `alt=""` for decorative images.
- Use meaningful `alt` for informative images and brand marks.
- Use `next/link` for internal navigation.

## Motion And Feedback

Use subtle transitions only:

- `transition-colors duration-200` for hover and selected states.
- `transition-all duration-200` only for nav elements where size and position are stable.
- Do not use hover scale on cards or buttons.
- Respect reduced motion for any larger animation.

Every interactive element needs:

- Clear hover feedback.
- Visible `focus-visible` ring.
- `cursor-pointer` where the base element does not already imply clickability.
- A hit target around 44px when possible.

## Forms

Passenger forms should feel like mobile settings screens, not desktop data entry.

Rules:

- Use visible labels.
- Use `h-11` or `h-12` inputs for touch comfort.
- Use rounded inputs around `rounded-[1.2rem]` or `rounded-2xl`.
- Group related fields in one passenger surface.
- Put the save action at the bottom of the form group or sticky bottom area when the flow is long.
- Inline validation should say how to fix the issue.
- Read-only fields should use `bg-muted/30` and clear labels.

Example error patterns:

- `Phone number must include 11 digits.`
- `We could not save your profile. Check your connection and try again.`

## Status, Empty, Loading, Error

Use shared page states where possible:

- `PageLoadingState` for full-page loading.
- `InlineErrorState` for recoverable page sections.
- `StatusBadge` for rides and reservations.
- `PassengerShellSkeleton` patterns for passenger page skeletons.

Status chips should use semantic tokens from `app/globals.css`:

- Searching or pending: info.
- Matched, confirmed, completed: success.
- En route or in trip: primary.
- Cancelled: destructive.

Empty states should be short and action-oriented:

- Title: what is missing.
- Body: why it matters or what happens next.
- CTA: the next useful action.

Avoid dead-end errors. Always provide a retry, route, or next step when possible.

## UX Writing

Voice:

- Clear, local, and helpful.
- Direct when the passenger is mid-task.
- Reassuring when something fails.
- Brief when confirming success.

Terminology:

- Use `TODA` for terminal and queue experiences.
- Use `Ride` for booking and live on-demand flow.
- Use `Trips` for ride history inside Activity.
- Use `Reservations` for TODA reservations.
- Use `Account` for the passenger account hub.
- Use `Profile` only for identity editing.

Copy rules:

- Buttons should be 2 to 4 words.
- Titles should be 3 to 6 words when possible.
- Error messages should explain what failed and what to do next.
- Do not blame passengers.
- Do not expose technical error codes without a plain-language explanation.
- Avoid unsupported promises like wallet, saved places, live chat, or contact driver.

Good patterns:

- `Book your next tricycle ride`
- `Where are you going?`
- `Terminal info is updating. You may still book a ride.`
- `Reservation confirmed. Your queue position has been saved.`
- `Cancellation is only available while the reservation is still confirmed.`
- `We could not load some home details right now. Please try again.`

Poor patterns:

- `Submit`
- `Oops, something went wrong`
- `Invalid request`
- `Contact your driver`
- `Top up wallet`
- `Saved places`

## Accessibility

Passenger screens must pass these checks:

- Text contrast meets WCAG AA.
- Icon-only controls have `aria-label`.
- Decorative images use empty alt text.
- Informative images have meaningful alt text.
- Focus states are visible on every interactive element.
- Text does not overlap on 375px wide screens.
- Long place names and addresses use `min-w-0` and `truncate`.
- UI does not depend on color alone to explain status.
- Tabs, buttons, links, and form controls remain keyboard accessible.

## Responsive Rules

Design and test from smallest to largest:

- 375px mobile.
- 390px mobile, where optional small icons may appear.
- 768px tablet.
- 1024px and wider desktop with centered mobile frame.

Rules:

- No horizontal scroll.
- No fixed text widths that break with long local names.
- Use `min-w-0` in flex and grid children that contain text.
- Use `truncate` for place names, terminal names, addresses, and route strings.
- Preserve bottom nav and safe-area spacing on all passenger pages.
- Do not scale font size with viewport width except approved `clamp()` hero text from the home pattern.

## Redesign Checklist

Before redesigning any passenger screen, confirm:

- The route uses `PassengerAppShell`.
- The page matches one screen archetype in this guide.
- The page has one obvious primary action.
- Colors use passenger theme tokens.
- The bottom nav remains consistent.
- Typography follows the passenger hierarchy.
- Surfaces use the rounded, soft passenger panel language.
- Icons come from Lucide.
- Transport imagery uses existing TRISSEA assets when relevant.
- Copy uses passenger terminology from this guide.
- Loading, empty, and error states are designed.
- Mobile at 375px is usable with no overlap.
- Focus and hover states are present.
- Unsupported features are not implied.

## Passenger Redesign Order

When redesigning the passenger area, use this order so shared patterns stabilize first:

1. `PassengerAppShell`, topbar, bottom nav, and shared passenger surfaces.
2. `/passenger/home`.
3. `/passenger/on-demand`.
4. `/passenger/toda`.
5. `/passenger/activity`.
6. `/passenger/scan`.
7. `/passenger/modules`, `/passenger/tricycle`, `/passenger/jeepney`.
8. `/passenger/account` and nested account pages.

## Design Review Rubric

Use this rubric before merging a passenger redesign:

| Area | Pass condition |
| --- | --- |
| Shell | Uses the passenger shell and preserves safe areas. |
| Action hierarchy | One primary action is visually dominant and task-relevant. |
| Visual language | Rounded panels, soft borders, green/yellow token system, and compact metrics match Home. |
| Content | Copy is short, local, useful, and aligned with passenger terminology. |
| State handling | Loading, empty, active, success, and error states are designed. |
| Responsiveness | 375px mobile has no overlap or horizontal scroll. |
| Accessibility | Focus states, labels, alt text, and color contrast are present. |
| Product honesty | UI does not promise unsupported passenger surfaces. |
