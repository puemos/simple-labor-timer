# Releasing

This document is for maintainers with access to the Expo, Apple, and Google Play accounts.

## EAS Setup

Store releases are configured for Expo EAS and run from `.eas/workflows/release.yml` when a Git tag matching `v*` is pushed. The workflow verifies the app, builds Android and iOS production binaries, submits Android to the configured Play track, and uploads iOS to App Store Connect/TestFlight. iOS App Review submission remains a manual App Store Connect step.

Initial setup:

```sh
pnpm exec eas login
pnpm exec eas init
pnpm exec eas credentials --platform ios
pnpm exec eas credentials --platform android
```

`eas init` writes the EAS project ID into the Expo app config. Commit that `extra.eas.projectId` change with release automation setup.

## Before The First Release

- Create the App Store Connect app record for `app.simplelabortimer`, then set `submit.production.ios.ascAppId` in `eas.json` to the Apple ID from App Information.
- Create the Google Play Console app for `app.simplelabortimer`, set pricing to free, complete Data Safety and privacy policy forms, and manually upload the first Android App Bundle because the Play API cannot do the first upload.
- Upload the Google service account key to EAS credentials after the first Play upload. Keep `.p8`, service-account JSON, and `credentials.json` files out of git.
- Enable GitHub Pages through GitHub Actions so these store URLs resolve:
  - `https://puemos.github.io/simple-labor-timer/`
  - `https://puemos.github.io/simple-labor-timer/privacy/`
  - `https://puemos.github.io/simple-labor-timer/support/`
- Keep Android submissions on the `internal` track until Play production access is granted. For a new personal Play developer account, expect a closed test with at least 12 opted-in testers for 14 continuous days before production access can be requested.

## Local Commands

```sh
pnpm run release:verify
pnpm run release:metadata:ios
pnpm run release:build
pnpm run release:submit:android
pnpm run release:submit:ios
```

To publish after account setup is complete:

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
