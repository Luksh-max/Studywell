# StudyWell quality assurance checklist

Use this checklist after each release. Mark a test complete only after it has been performed on the target device.

## First launch and navigation
- [ ] App opens on Overview without requiring a navigation tap.
- [ ] Every sidebar and mobile navigation item opens the correct page.
- [ ] Reloading the app does not leave the page content blank.
- [ ] Onboarding appears only when the app is unlocked and setup is incomplete.

## PIN and privacy
- [ ] Set PIN requires four digits and a matching confirmation.
- [ ] Wrong PIN is rejected and repeated attempts are delayed.
- [ ] Correct PIN unlocks the app.
- [ ] Leaving the app triggers auto-lock when enabled.
- [ ] Closing and reopening the app requests the PIN again.
- [ ] Changing and disabling the PIN requires the current PIN.
- [ ] Export, import, and delete-all flows confirm destructive actions.

## Tasks and reminders
- [ ] Create and edit tasks with a due date and optional reminder.
- [ ] Completing or deleting a task cancels its reminder.
- [ ] A scheduled task reminder can be delivered in the Android APK.
- [ ] Daily reminders respect the selected time and notification permission.
- [ ] Timer completion produces a reminder in the Android APK.
- [ ] Pausing or resetting a timer cancels the old alarm.

## Offline and data
- [ ] First hosted visit completes while online.
- [ ] PWA opens after network access is disabled.
- [ ] Android APK opens in airplane mode.
- [ ] Data survives app close/reopen and device restart.
- [ ] Invalid backup files are rejected without deleting current data.
- [ ] Restored tasks are re-scheduled for reminders.

## Layout and accessibility
- [ ] No horizontal overflow at 320, 360, 390, and 430 CSS-pixel widths.
- [ ] Inputs remain visible when the keyboard is open.
- [ ] Buttons have readable labels and large touch targets.
- [ ] Keyboard focus is visible and dialogs can be closed predictably.
- [ ] Reduced-motion preference is respected.

## Release integrity
- [ ] APK version name and version code increase.
- [ ] The same private signing key is used for every public release.
- [ ] Release notes match the changes in the APK.
- [ ] Latest APK installs and launches on a clean test device.
