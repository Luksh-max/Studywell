# Changelog

## 1.0.0 — First public release candidate

- Reworked the project around a readable vanilla JavaScript PWA and a bundled Android wrapper.
- Added task-specific reminders and Android local notifications for tasks, focus sessions, and daily check-ins.
- Strengthened app-lock lifecycle handling so a configured PIN is requested on fresh launch and app return.
- Added visible startup fallback content and an initialization error screen.
- Added Netlify/Vercel static-hosting configuration and GitHub Actions validation/build/release workflows.
- Added source-available usage terms, a detailed README, and a device QA checklist.

This changelog records the intended release contents. Complete the device QA checklist before describing all device behaviors as verified.

## 1.0.1 — Freeze and cache resilience patch

- Bumped the PWA cache version so existing installations replace stale cached app assets on update.
- Changed same-origin asset caching to network-first with a cached offline fallback, keeping offline launch support while allowing deployed fixes to reach users.
- Added visible error reporting for failed delegated actions, form submissions, page renders, and background JavaScript errors so a failed operation is not silently mistaken for an unresponsive interface.
- Synced the updated web files into the Android WebView asset bundle.
- Static project checks and JavaScript syntax checks pass. Full real-device freeze reproduction still needs to be checked on the hosted website and Android device.
