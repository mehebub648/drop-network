# Home actions, information and Community navigation - 0.0.158

final result: passed

- Source visual truth: `C:/Users/Mehebub/AppData/Local/Temp/codex-clipboard-0b826dc6-58c0-4324-938e-67e45e46cefc.png`, 900 × 1600 pixels. The user selected its concepts while explicitly rejecting its color and styling as a literal target.
- Implementation: `https://site-21000.91.108.104.57.mehebub.com/`, captured in the Codex in-app browser at 1265 × 713 CSS pixels and standard density after release. The matching native screen is saved at `C:/Users/Mehebub/WorkSpace/10-Projects/Personal/blood-donor-diectory/drop-android/release-artifacts/home-v1.0.34.png`, 800 × 1600 pixels from a 400 × 800 logical viewport at 2× density.
- State: guest home with B+ selected. The reference and phone implementation were opened together for the normalized mobile comparison; the hosted desktop rendering was then inspected independently at its wider responsive breakpoint.
- Full-view evidence: donor search remains the dominant surface; donor enrollment and request management are balanced secondary actions; recent requests retain group, urgency, facility and date hierarchy; helpful information uses quieter descriptive rows; Community is a primary bottom destination on phone and remains in desktop navigation.
- Focused evidence: labels, urgency pills, icons, descriptions and action destinations were readable at full resolution, so separate crops were unnecessary.
- Required surfaces: the established sans-serif hierarchy remains intact; card spacing and radii align across web and Flutter; restrained red/pink accents improve foreground balance; Lucide and Material icons use the existing product libraries; requested labels and real request data are preserved.
- Comparison history: the first final comparison found no actionable P0/P1/P2 issue. The deliberate white secondary surfaces and descriptive information rows improve the source's heavy color blocks. Responsive wrapping and scrolling preserve every control.
- Interaction evidence: the hosted See your requests action opened the existing private device-request screen. B+ selection, donor search, request links and Community use existing routes. Production build, health, readiness and static-asset checks passed with no horizontal clipping visible in the captured states.

---

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
  account-section sheet, and optional donor-profile fields stay available in
  collapsible sections with a persistent Save action.
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

## 0.0.160 / Android 1.0.38 launch candidate

- The desktop website and native app share warm neutral surfaces, restrained rose
  actions, clearer navigation, consistent controls and simpler spacing.
- Isolated rootless Compose validation passed: TypeScript, 170 unit tests, eight
  administrative integration groups, emergency-access regression and production
  image build. Full and runtime dependency audits reported zero vulnerabilities.
- A real browser checked the compiled isolated preview: blood-group handoff,
  member edit and undo, per-member audit, SMS controls, admin deep links, refresh,
  Back/Forward, and the 390-pixel mobile download cover. Privacy and listing removal
  remain available on mobile. Captures: `artifacts/launch-v0.0.160/`.
- Flutter analysis and 42 focused tests passed. Signed 1.0.38+39 APK and AAB were
  verified, with the existing signing certificate retained. Native fixture captures
  include 390-pixel home/request/account surfaces and 320-pixel home at 200% text.
- Local Docker Desktop was not started. Production was not changed; the isolated
  preview is not canonical hosted release evidence. Physical-device checks, real
  SMS failover and Play publication remain separate launch acceptance steps.

- The release was integrated with published main `655829d` before deployment.
  The combined image build, TypeScript, all 171 unit tests, eight admin integration
  groups and emergency-access integration passed. The latter explicitly checks
  the published three-request guest limit before granting outage access.
- Android source commit `ddead88` matches the signed 1.0.38+39 build. An installed
  emulator upgrade and cold launch passed. Private Firebase authentication and
  an FCM validation-only request passed without delivering a notification.

## Canonical 0.0.160 release - 2026-10-08

- Website/backend code commit: `fb472900ea840a754da91f2ee72bda0c0631ed4a`.
  Android source: `ddead88f2271f45f8b0d3820b8ab049f4933adb8`, version 1.0.38+39.
  [GitHub CI](https://github.com/mehebub648/drop-network/actions/runs/37797811055)
  passed typecheck, 171 unit tests, bundle, dependency audit and secret scanning.
- Panelavo deployed only Drop's rootless app on loopback port 31000. The container
  is healthy with restart count zero; `/`, `/health`, `/ready` and the hashed
  application asset returned 200. All 12 runtime static-asset checks passed.
- A private non-disruptive backup restored all 14 original data tables with
  matching versions and counts. Existing private environment settings, donor
  sources and community media were preserved. After test cleanup, donor totals
  were 134,588 (134,586 imported, two registered), with two available donors and
  two open requests, matching the baseline.
- Six protected HTTPS acceptance groups passed: overview, account edit/audit/undo,
  failed-login redaction, request/comment/post moderation, disabled provider
  encryption/redaction/persistence and human-readable audit projection. Exact
  disposable operational records and sessions were removed; their labelled,
  immutable audit history remains. Existing provider configuration was unchanged.
  No OTP or SMS was sent.
- A real browser on the canonical origin passed donor-group handoff, requests and
  community detail, admin deep links/refresh/Back/Forward, member undo and disabled
  `Undone` state, saved disabled provider state and blank credential field. Android
  UA at 390 pixels showed the download cover and allowed privacy/listing removal.
  No console warnings/errors or failed network requests were recorded. Rendered
  captures are in `artifacts/launch-v0.0.160/canonical-*`; Messavo evidence is the
  live API/DOM interaction, not a screenshot.
- The full canonical APK download matched the signed artifact byte for byte:
  SHA-256 `d60798723a04ab37b45349237ac1c8c3875a63b2981b1984f23ddbf16565ffca`.
  The private push sender and stable SMS encryption key are active and backed up.
  Real-device push/SMS delivery acceptance and Play upload remain in `PLAN.md`.

## Desktop homepage correction - 0.0.161

The user-reported screenshot exposed a missed CSS cascade regression: at a
1536-pixel desktop viewport, a trailing legacy block narrowed the home to 920
pixels, enlarged the header to 100 pixels and left the heading at 84.48 pixels
across six lines. The earlier acceptance covered interactions but did not catch
these poor proportions.

The conflicting trailing block is removed. An isolated rootless production
preview passed visual checks at 1280, 1536 and 1920 pixels: two-line heading,
76-pixel shared header, top-aligned white search panel and no horizontal overflow.
The O-negative selection reached `/directory?blood_group=O-` with the correct
location step. No browser console warnings or errors occurred. The supported
hosted image build passed; local Docker Desktop was not started.

## Desktop website redesign - 0.0.162

- Rebuilt the shared desktop frame, typography, surfaces and controls across
  public pages, donor search, account screens and administration. Removed
  competing legacy themes and put shared styles in the CSS components layer.
- An isolated site-user rootless Compose preview passed TypeScript and production
  bundling. Browser checks covered 820, 1024, 1280 and 1536-pixel layouts, collapsed
  navigation, donor search through results, request filters, community, information
  pages, sign-in, member forms and administration. No horizontal overflow was
  observed in the checked desktop layouts.
- The upazila dropdown accepts typed filtering and keyboard selection without
  overlapping form actions. Escape closes a select inside the request-filter
  dialog while leaving the dialog open. All eight donor blood groups stay on one
  guided-form step; a changed selection survives Continue and Back.
- Protected preview checks used disposable fixtures with no production data or
  SMS credentials. The provider form was inspected without saving. No real OTP,
  SMS or member changes were submitted. Preview HMR websocket errors came from
  the SSH tunnel; pages were reloaded after source updates.
- Local Docker Desktop checks were skipped under repository policy. Canonical
  release checks and screenshots are recorded separately after deployment.
