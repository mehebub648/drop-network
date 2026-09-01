# Responsive Experience Design QA

## Coverage

- Desktop: 1440 × 900 public, information, request, community, and member
  route families.
- Mobile web: 390 × 844 across the same route families.
- Android: 1080 × 2400 emulator captures for Find, Requests, Community, and
  Account, plus the protected request coordination transition.

## Release findings

- The landing page begins with donor search, followed by a compact live-network
  strip and expandable contact, safety, privacy, and donation guidance. The
  same capabilities remain available without repeating promotional sections.
- Requests uses a single count/filter row, 20-result pages, profile defaults,
  and a visually quieter fallback section for related emergencies.
- Task, account, authentication, and protected workflow routes do not inherit
  the promotional footer. The remaining mobile information footer is compact.
- Member identity appears once; mobile navigation opens from an accessible
  account-section sheet instead of an overflowing horizontal rail.
- Community preview and post management are collapsed secondary actions rather
  than competing with the editor.
- Information and legal pages retain their content while adding a compact
  contents navigator and denser mobile reading layout.
- Android embedded documents are marked before React paints, suppressing
  duplicated site chrome and desktop spacing without changing security gates.

## Release gate

GitHub CI must pass before deployment. Hosted desktop/mobile checks must show
no horizontal overflow, failed requests, console errors, broken keyboard focus,
or unresolved P0–P2 visual defect. Any failure stops or rolls back the release.

final result: release-gated
