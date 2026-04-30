Do not design this like a website inside a phone frame.

Mobile UI rules:
- Do NOT wrap every section in a separate card.
- Use at most 1 primary surface per screen and 1 secondary inset surface if needed.
- Prefer full-bleed layouts, list rows, grouped sections, bottom sheets, and sticky action areas over stacked floating cards.
- Bottom navigation must have only 3-5 top-level destinations.
- Put utility actions like Profile/Account in the top-right app bar, not in bottom nav.
- For map-heavy flows, use map + bottom sheet, not map + many cards.
- Use section dividers, spacing, and typography to organize content instead of drawing boxes around everything.
- Use skeleton loading for page/section loads; do not use generic full-screen spinners.
- Avoid dashboard-style KPI cards in the passenger app.
- Prefer:
  - list rows
  - grouped settings lists
  - segmented tabs
  - sticky bottom CTA
  - bottom sheets
  - full-width content areas
- The app must feel like a native mobile product, not a desktop dashboard shrunk into a phone.