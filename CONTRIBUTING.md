# Contributing

Thanks for helping improve Simple Labor Timer. This app handles sensitive labor-related data, so privacy, safety copy, and predictable behavior matter more than feature count.

## Before You Start

- Search existing issues and pull requests before opening a new one.
- Keep changes focused. Separate unrelated refactors from feature or bug-fix work.
- Do not post private medical information, phone numbers, names, notes, screenshots with personal data, or contraction logs in public issues or pull requests.

## Local Setup

```sh
pnpm install
pnpm start
```

Use development builds instead of Expo Go because this app depends on native modules such as SQLCipher, Worklets/Reanimated, and SecureStore.

## Checks

Run these before opening a pull request:

```sh
pnpm exec expo install --check
pnpm run verify
```

`pnpm run verify` runs lint, TypeScript, and unit tests.

Native dependency changes also require a development-build smoke test:

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm exec expo run:ios --no-install
```

## Safety And Medical Copy

- Do not add language that diagnoses labor, estimates cervical dilation, monitors fetal wellbeing, or recommends a birth setting.
- Urgent-warning copy should tell users to contact their care team or emergency services, not rely on timing alone.
- Keep timing rules conservative and source-linked when adding or changing medical-adjacent guidance.
- Preserve the app's statement that it is not medical advice and not a medical device.

## Privacy

- Do not add account, backend, analytics, tracking, advertising, payment, or subscription behavior without an explicit privacy review.
- Keep exports user-initiated and local-first.
- Be careful with logs. Do not log contraction notes, phone numbers, pregnancy profile details, or urgent event details.

## Translations

App translations live in `src/i18n/locales/*.json`. Every locale file must keep the same key set as `src/i18n/locales/en.json`.

When changing strings:

- Update English first.
- Update every locale file or intentionally keep the same value where a translation is not ready.
- Run `pnpm run test -- src/i18n/i18n.test.ts` to verify locale coverage.
- Have safety-sensitive copy reviewed by someone fluent in the target language where practical.

## Pull Requests

Good pull requests include:

- A short explanation of the user-visible change.
- Screenshots or screen recordings for UI changes.
- Notes about privacy, safety copy, and localization impact.
- The verification commands you ran.

Maintainers may ask for smaller diffs, tests, source links for medical-adjacent copy, or manual smoke-test notes before merging.
