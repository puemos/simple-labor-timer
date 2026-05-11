# Simple Labor Timer

Simple Labor Timer is a free, local-first contraction timer for iOS and Android. It records contraction start and end times, shows duration and start-to-start rhythm, stores care-team call rules, records urgent warning events, and lets users share private summaries with their care team.

The app is built for privacy and calm use during labor. It has no account, backend, analytics, tracking, ads, subscriptions, or paid unlock path.

## Safety And Privacy

- This app is not a medical device and does not provide medical advice, diagnosis, treatment, labor confirmation, fetal monitoring, or birth-setting recommendations.
- Contraction data, notes, care-team phone numbers, pregnancy settings, urgent events, language, and theme settings stay on the device unless the user chooses to share an export.
- Share and PDF files are created on the device and handed to the native share sheet.
- Medical copy and timing rules should stay conservative, source-linked, and explicit about the app's limits.

## Features

- One-tap contraction timer with haptics and large controls.
- Session history with editable contraction records, notes, intensity, split, merge, delete, and restore.
- Rhythm summaries for average duration, frequency, trend, and saved call-rule status.
- Urgent warning screen for events that should override timing.
- Local text and PDF exports for care-team updates.
- Multilingual UI with RTL support for Arabic.
- Encrypted SQLite persistence on native builds.

## Stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- TypeScript strict mode
- Expo SQLite with SQLCipher enabled
- SecureStore for local database keys and preferences
- i18next and React i18next
- Vitest for domain tests
- Expo ESLint config

## Development

Use the repo-pinned pnpm version and Node 22 or newer within the supported range.

```sh
pnpm install
pnpm start
```

Useful app targets:

```sh
pnpm ios
pnpm android
pnpm web
```

Use development builds, not Expo Go, because native modules such as SQLCipher, Worklets/Reanimated, and SecureStore must be present in the native binary.

For iOS builds, CocoaPods may require an explicit UTF-8 locale:

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
```

The `ios/` and `android/` directories are intentionally untracked. Keep app config and dependencies in source control, then use Expo commands when native projects are needed locally.

## Verification

Run the full local check before opening a pull request:

```sh
pnpm exec expo install --check
pnpm run verify
```

`pnpm run verify` runs lint, TypeScript, and unit tests.

Native dependency changes also need a development-build smoke test:

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm exec expo run:ios --no-install
```

## Project Layout

```text
app/          Expo Router routes and screen composition
src/domain/   Pure timing, rules, summaries, and export logic
src/data/     SQLite, migrations, repository contracts, local persistence
src/i18n/     Locale resources and translation setup
src/state/    App command/store orchestration
src/native/   Native API facades
src/ui/       Design tokens, theme, icons, and reusable components
docs/         GitHub Pages, privacy, support, and maintainer docs
metadata/     Store listing copy by locale
locales/      Native app display-name locale files
```

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes, especially for safety copy, translations, privacy-sensitive behavior, and native dependencies.

Do not include private medical information, phone numbers, names, notes, screenshots with personal data, or contraction logs in public issues.

## Releases

Store release notes and EAS maintainer commands live in [docs/releasing.md](docs/releasing.md).

## License

Simple Labor Timer is available under the [MIT License](LICENSE).
