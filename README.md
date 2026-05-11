# Simple Labor Timer

Local-first contraction timer built with Expo, React Native, TypeScript, encrypted SQLite, and a deterministic timing/rules domain layer.

The app records contraction start/end timestamps, summarizes duration and start-to-start frequency, surfaces saved care-team call rules, records urgent warning events, and lets the user preview/share text, CSV, or PDF summaries.

## Safety And Privacy

- This app does not diagnose labor, estimate cervical dilation, monitor fetal wellbeing, or decide whether a birth setting is safe.
- Contraction data, notes, care-team phone numbers, and settings stay on device unless the user explicitly shares an export.
- There is no account, backend, analytics, tracking, ads, subscription, or paid unlock path.
- Medical copy and timing rules should remain source-linked, conservative, and explicit about the app's limits.

## Stack

- Expo SDK 54
- React Native 0.81.5
- React 19.1
- Expo Router
- TypeScript strict mode
- Vitest for domain tests
- Expo ESLint config
- Expo SQLite with SQLCipher enabled in app config

## Setup

Use the repo-pinned pnpm version and Node 22.

```sh
pnpm install
```

For iOS builds, CocoaPods may require an explicit UTF-8 locale in this shell:

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
```

The generated `ios/` and `android/` folders are ignored. Commit app config and dependencies, then regenerate native projects through Expo when needed.

## Development

```sh
pnpm start
pnpm ios
pnpm android
pnpm web
```

Use development builds, not Expo Go, because native modules such as SQLCipher, Worklets/Reanimated, and SecureStore must be present in the native binary.

If iOS opens a stale dev-client bundle after native dependency changes, clear Metro and rebuild:

```sh
pnpm exec expo start --dev-client --localhost -c
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm ios
```

## Verification

```sh
pnpm exec expo install --check
pnpm run verify
```

`pnpm run verify` runs lint, TypeScript, and unit tests.

Native dependency changes also require a development-build smoke test:

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm exec expo run:ios --no-install
```

## Store Release Automation

Store releases are configured for Expo EAS and run from `.eas/workflows/release.yml` when a Git tag matching `v*` is pushed. The workflow verifies the app, builds Android and iOS production binaries, submits Android to the configured Play track, and uploads iOS to App Store Connect/TestFlight. iOS App Review submission remains a manual App Store Connect step.

Initial setup:

```sh
pnpm exec eas login
pnpm exec eas init
pnpm exec eas credentials --platform ios
pnpm exec eas credentials --platform android
```

`eas init` writes the EAS project ID into the Expo app config. Commit that generated `extra.eas.projectId` change with the release automation setup.

Before the first real release:

- Create the App Store Connect app record for `app.simplelabortimer`, then replace the temporary `0000000000` `ascAppId` in `eas.json` with the Apple ID from App Information.
- Create the Google Play Console app for `app.simplelabortimer`, set pricing to free, complete Data Safety and privacy policy forms, and manually upload the first Android App Bundle because the Play API cannot do the first upload.
- Upload the Google service account key to EAS credentials after the first Play upload. Keep `.p8`, service-account JSON, and `credentials.json` files out of git.
- Enable GitHub Pages through GitHub Actions so the store URLs resolve:
  - `https://puemos.github.io/simple-labor-timer/`
  - `https://puemos.github.io/simple-labor-timer/privacy/`
  - `https://puemos.github.io/simple-labor-timer/support/`
- Keep Android submissions on the `internal` track until Play production access is granted. For a new personal Play developer account, expect a closed test with at least 12 opted-in testers for 14 continuous days before production access can be requested.

Useful local release commands:

```sh
pnpm run release:verify
pnpm run release:metadata:ios
pnpm run release:build
pnpm run release:submit:android
pnpm run release:submit:ios
```

To publish a release after account setup is complete:

```sh
git tag v1.0.0
git push origin v1.0.0
```

When Google Play production access is granted, change `submit.production.android.track` in `eas.json` from `internal` to `production`.

## Dependency Policy

- Use `pnpm exec expo install <package>` for Expo-managed native packages.
- Keep `react-native-reanimated` and `react-native-worklets` on Expo SDK-compatible versions.
- Run `pnpm exec expo install --check` before committing package changes.
- Rebuild the development client after any native dependency changes.

## Project Layout

```text
app/          Expo Router routes and screen composition
src/domain/   Pure timing, rules, summaries, and export logic
src/data/     SQLite, migrations, repository contracts, local persistence
src/state/    App command/store orchestration
src/native/   Native API facades
src/ui/       Design tokens, theme, icons, and reusable components
assets/       App icons and splash assets
```
