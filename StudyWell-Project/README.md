# StudyWell

**An offline-first study system built to help students plan realistically, focus deliberately, and review their progress without an account or cloud dependency.**

StudyWell is a mobile-first web app and Android APK project created by **Luksh Kumar**. The core experience uses plain HTML, CSS, and JavaScript. The Android app bundles the same local web assets inside a native WebView wrapper, so the installed APK does not need to fetch the interface from a website.

> **Try the app:** the web version can be deployed from the `web/` directory. A signed Android APK is published under GitHub **Releases** after the release-signing setup is completed. The source repository is available for evaluation; please do not copy it and claim it as your own or republish it without permission.

## Why this project exists

Many study apps ask students to keep adding tasks, streaks, and timers. StudyWell is designed around a more practical question: *given the time and energy available today, what is the next useful thing to do?*

Its workflow connects four steps:

1. **Plan:** create a realistic daily mission and map exam topics.
2. **Focus:** start a timed session with a specific goal.
3. **Record:** mark the outcome, note distractions, and review flashcards.
4. **Reflect:** compare planned work with recorded effort and adjust the next plan.

The app does not claim that tracked minutes prove understanding or guarantee better grades. It gives students a private way to notice patterns and choose a manageable next step.

## Features

| Area | What it does |
| --- | --- |
| Daily mission | Builds a local plan from available time, energy, task priorities, and chapter deadlines. |
| Exam readiness | Tracks subjects, topics, exam dates, difficulty, and preparation status. |
| Study planner | Add, edit, complete, reopen, filter, and delete tasks; set due dates and optional reminders. |
| Focus timer | Adjustable focus and break lengths, a session goal, pause/resume, and recorded outcomes. |
| Offline flashcards | Create questions and answers, review them, and schedule the next review. |
| Mood check-in | Record a simple self-rating and optional note. |
| Private journal | Search and edit local entries, with draft saving while typing. |
| Guided breathing | Follow a visual breathing pattern with a stop-anytime control. |
| Weekly insights | Review focus time, completed tasks, subject breakdown, and mood/focus values side by side. |
| Comeback mode | Offers a small restart after a gap instead of pressuring users with streak loss. |
| Themes | 25 restrained color palettes with responsive layouts and touch-sized controls. |
| Privacy tools | Optional PIN barrier, local JSON export/import, and a delete-all control. |
| Reminders | Browser reminders while the PWA is active and native local notifications in the Android APK. |
| Offline PWA | Local manifest, app icons, service worker cache, and offline fallback. |

## Quick links

- **Web source:** [`web/`](web/)
- **Android wrapper:** [`android/`](android/)
- **Project checks:** [`scripts/check-project.mjs`](scripts/check-project.mjs)
- **Release workflow:** [`.github/workflows/release-apk.yml`](.github/workflows/release-apk.yml)
- **Test APK workflow:** [`.github/workflows/android-debug.yml`](.github/workflows/android-debug.yml)
- **License and usage terms:** [`LICENSE`](LICENSE)

When this repository is named `studywell` under the GitHub account `Lucky-tech123`, the latest signed APK download link will be:

**[Download the latest StudyWell APK](https://github.com/Lucky-tech123/studywell/releases/latest/download/StudyWell.apk)**

GitHub Release assets use versioned filenames such as `StudyWell-1.0.0.apk`. The release workflow publishes both the versioned APK and the stable `StudyWell.apk` alias, so the latest link stays the same after future releases.

## Run the web app locally

You do not need npm packages or a build step for the web version.

1. Download or clone this repository.
2. Open a terminal in the repository root.
3. Start a local static server:

   ```bash
   python -m http.server 8000 --directory web
   ```

4. Open `http://localhost:8000` in a browser.

A `file://` URL is useful for a quick visual check, but it does not provide full service-worker or PWA installation behavior. For PWA testing, use HTTPS hosting or localhost.

## Deploy the PWA on Netlify

Netlify is the recommended static host for this repository. The app itself has no server-side dependency; hosting is only used to deliver the first copy of the static files.

1. Push this repository to GitHub.
2. In Netlify, create a new site from the Git repository.
3. Use the repository root as the base directory and `web` as the publish directory. The included `netlify.toml` already sets the publish directory.
4. Deploy and open the HTTPS URL once while online.
5. In Android Chrome, open the three-dot menu and choose **Install app** or **Add to Home screen** if the browser offers it.
6. Open the installed PWA once, then test it in airplane mode.

The exact install wording depends on Chrome and Android versions. A PWA cannot force both menu options to appear simultaneously. The first hosted visit needs a connection so the browser can download and cache the files; the app is designed to use those cached files offline afterwards.

Vercel is also supported for static hosting through the included `vercel.json` configuration.

## Build and download the Android APK

The APK is a native Android shell around the same offline web app. It uses Android's local asset loader and does not request the `INTERNET` permission. Local task and timer reminders use Android's notification system; the user must grant notification permission.

### Test build

Every push to `main` can build a test APK through GitHub Actions:

1. Open the repository's **Actions** tab.
2. Select **Build Android test APK**.
3. Open the completed run and download the `StudyWell-debug-test-apk` artifact.

This artifact is for testing. GitHub stores it as a workflow artifact, so it is not the same as a public release asset.

### Signed release and future updates

A public release APK must keep the same signing key across versions. Do not generate a new key for every release; Android will reject an update signed by a different key.

1. Generate one private Android release keystore and keep a secure backup of it. On a computer with Java installed, or in Termux after installing a Java package, run:

   ```bash
   keytool -genkeypair -v -keystore studywell-release.jks -alias studywell-release -keyalg RSA -keysize 3072 -validity 10000
   base64 studywell-release.jks | tr -d '\n'
   ```

   Save the keystore file and passwords somewhere private. Copy the Base64 output directly into the matching GitHub secret; do not paste it into a public issue or commit it to Git.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add these repository secrets:
   - `ANDROID_KEYSTORE_BASE64` — the keystore file encoded as Base64, with no line breaks.
   - `ANDROID_KEYSTORE_PASSWORD` — the keystore password.
   - `ANDROID_KEY_ALIAS` — the key alias.
   - `ANDROID_KEY_PASSWORD` — the key password.
3. Never commit the keystore, passwords, or Base64 secret into the repository.
4. Create a version tag, for example `v1.0.0`, and push the tag.
5. The `Build and publish a signed Android release` workflow builds the signed APK and attaches it to a GitHub Release.
6. For the next version, update the version notes and push a new tag such as `v1.1.0`. Keep the same signing key.

The release workflow intentionally stops if signing secrets are missing. Publishing an APK with a temporary signing key would make future in-place updates unreliable.

## Privacy and offline architecture

- No account, cloud database, external API, analytics SDK, CDN, or remote font is required by the app.
- Study records use IndexedDB when available, with a local storage fallback.
- The PWA service worker caches local interface files. The Android APK includes those files in its package.
- Exported JSON backups may contain journal text and other personal records. Store them privately.
- The optional four-digit PIN uses a salted, slow-derived verifier and throttles repeated failed attempts. It is an access barrier, **not full encryption** of every record in browser storage. Use the phone's own screen lock too.
- Browser notification timing is best-effort when the PWA is not active. The Android APK schedules local alarms, but Android battery controls may delay delivery and notifications require permission.
- Android uses inexact alarms to avoid requesting special exact-alarm access. Reminders can be delayed by the operating system.

## Code structure

```text
StudyWell/
├── web/
│   ├── index.html          # Application shell and navigation
│   ├── css/styles.css      # Readable responsive design system and themes
│   ├── js/app.js           # Screens, planner, timer, reminders and interactions
│   ├── js/storage.js       # Local persistence and backup validation
│   ├── manifest.json      # PWA installation metadata
│   ├── sw.js               # Offline cache and notification clicks
│   └── icons/              # Local app icons
├── android/
│   └── app/src/main/       # Native Android wrapper and reminder receivers
├── scripts/
│   └── check-project.mjs   # Syntax, manifest and asset checks
├── .github/workflows/      # Quality checks and APK build/release automation
├── netlify.toml
├── vercel.json
├── LICENSE
└── README.md
```

The CSS and JavaScript are kept readable rather than minified, so the implementation can be inspected, debugged, and discussed during a portfolio review.

## Validation status

The repository includes repeatable static checks for JavaScript syntax, PWA metadata, and required local assets. GitHub Actions also builds the Android wrapper in a clean Linux runner.

Before describing the project as fully device-tested on a CV, test the deployed PWA and APK on a real Android phone for:

- first launch and first-screen rendering;
- PIN setup, wrong PIN, correct PIN, background lock, close/reopen lock, and PIN removal;
- task create/edit/complete/delete and reminder cancellation;
- timer start, pause, resume, reset, and completion notification;
- app relaunch while offline;
- backup export/import and malformed backup rejection;
- Android notification permission and reboot reminder restoration;
- small-screen layout, keyboard overlap, and accessibility focus.

No repository can guarantee notification delivery under every Android battery-management setting. The implementation and test status should be described honestly in a scholarship or CV application.

## Versioning

- `v1.0.0`: first public signed release.
- Increase the patch number for fixes (`v1.0.1`), the minor number for compatible features (`v1.1.0`), and the major number for breaking changes (`v2.0.0`).
- Add a short release note for each tag, including what changed and what was tested.

## Attribution and usage

StudyWell is published for reviewers to inspect and evaluate the implementation. You may download and run it for personal evaluation. Do not repost the project, redistribute copies, remove attribution, or claim the work as your own without prior written permission. See [`LICENSE`](LICENSE) for the complete terms.

Public code can be copied by others in practice; the license states the permitted use but cannot technically prevent someone from taking a copy. Keep your commit history and development notes as evidence of your work.
