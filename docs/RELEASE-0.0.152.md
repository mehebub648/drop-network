# Drop experience release — 2026-09-04

Web/backend version: **0.0.152**, runtime source commit
`31c07721e1e05ed906215cb62fd458f2640f40e6`.
Native version: **1.0.19+20**, source commit
`f52baf3` in `drop-android`.

## Verified

- Fresh private source ZIPs (including uncommitted source), Git bundles,
  per-entry archive checks and SHA-256 checksums before implementation.
- Separate private production snapshot of configuration, LanceDB, community
  media and donor sources before migration; another verified pre-release snapshot
  and retained previous container image for rollback.
- Isolated rootless container typecheck, 150 unit tests, fake-SMS integration
  and frontend production build. Integration covers consent/privacy, device
  isolation, duplicate publication, authentication branches, adoption, expiry,
  overdue contact, closure and staff permissions. No real OTP or donor contact.
- Flutter analysis and 46 tests, including donor opt-out, explicit availability,
  staff capabilities, labels, touch targets, contrast and enlarged text.
- Android emulator guest publication, relaunch/preserved answers, management and
  closure. Real TalkBack focus/activation checks covered blood group, Continue,
  district search, picker Back, account phone and missing-phone validation.
  Actual SpeechController/TTS output was inspected; physical audio was not heard.
  Temporary TalkBack speech-debug settings were restored.
- Browser guest publication/management/closure and Back checks used isolated
  test data. Desktop and narrow layouts, keyboard selectors, focus restoration,
  calendar bounds and consent were checked. A narrow account layout was checked
  with root text doubled from 16px to 32px; this is text reflow, not browser zoom.
- Signed release APK installed and launched on the emulator without clearing
  the existing app's data. Release certificate SHA-256:
  `bbcffba8082b9da697b88b97818806f198b2ff2ed1bbc32281328c1b2b8c5807`.
  APK SHA-256:
  `308cb5a9b0bc84c5cb6e0c04eca92a669a8c0ed4120f293078b4fdb55b65f4ef`.
- Canonical live origin: homepage, health, readiness, final hashed asset,
  `/api/guest/requests`, `/api/v1/guest/requests` and public configuration all 200.
  Live account inline validation and selector keyboard/focus behavior passed;
  no console exceptions or failed requests during those interactions.
- Exact runtime version/source, healthy container, zero restarts, loopback-only
  port 31000, clean production checkout and private file/configuration checksums.
  Donor counts unchanged: 134,588 total, 134,586 imported and 2 registered.
  Live request count remained 1. Public feed had none of the checked private
  credential, account-phone or DOB keys.
- Only Drop's app service was recreated. The isolated test containers, networks,
  tunnel and emulator were stopped; QA app packages and ephemeral test data were
  removed. Signed app, evidence and private rollback artifacts were retained.

## Limitations

- The dependency registry audit endpoint timed out or rejected audit requests.
  The identified `qs` advisories were patched to 6.16.0, but a full clean audit
  result is **not verified**. Do not interpret successful builds as an audit pass.
- Authenticated journeys were tested with isolated API/widget/integration
  fixtures, not real production accounts or real SMS. TalkBack coverage is a
  focused emulator pass, not an exhaustive spoken traversal of every staff form.
- Local Docker Desktop was not started. Web/backend checks ran in isolated hosted
  rootless containers; no host-side Node/npm validation was substituted.
- The hosting connector's confirmation handshake was unavailable and its file
  backup could not read rootless-owned database files. Approved SSH fallback used
  the exact site user/rootless daemon for deployment and private privileged
  filesystem access for snapshots; no permission changes to production data.

No blanket production-readiness claim is made beyond the checks above.
