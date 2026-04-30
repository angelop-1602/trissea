Modular architecture note:
- Read `.codex/context/modular-platform.md` first for the canonical shared-vs-module rules, tricycle vs jeepney boundaries, and future multi-module direction.

You are working inside an existing Next.js App Router + TypeScript + Prisma + Supabase + PWA project for a tricycle booking system.

Important rules:
- Do NOT rewrite the whole passenger app at once.
- Implement only the requested phase.
- Scan the codebase first before changing anything.
- Preserve existing working behavior unless this phase explicitly changes it.
- Reuse existing layouts, components, map primitives, auth flow, and styling patterns where possible.
- Keep the passenger app separate from the driver app.
- Do NOT merge passenger and driver pages into one shared mobile shell if their workflows differ.
- Keep passenger mobile-first.
- Keep on-demand rides and TODA reservations as separate concepts.
- Do NOT add digital payments unless the phase explicitly says so.
- Do NOT invent wallet functionality if it is not real in code.
- Do NOT add ratings/reviews unless explicitly requested.
- Prefer focused mobile UX:
  - bottom navigation for main destinations
  - top-right account/profile access
  - map + bottom sheet where appropriate
  - clear state-driven screens
- Before coding, inspect the repository and summarize:
  1. files to change
  2. routes/pages impacted
  3. data/API impact
  4. migration impact
  5. risks
- Then implement only the requested phase.
- After implementation, provide:
  1. summary of changes
  2. changed files
  3. migration steps if any
  4. manual QA checklist
  5. follow-up notes for the next phase
