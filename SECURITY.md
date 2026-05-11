# Security Policy

Simple Labor Timer stores sensitive local health-adjacent data. Please report security or privacy issues carefully.

## Supported Versions

Security fixes target the current `main` branch unless maintainers publish separate release branches.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting if it is enabled for this repository. If it is not enabled, open a minimal public issue asking for a private reporting path and do not include exploit details, personal data, or sensitive logs.

Please include:

- A concise description of the issue.
- Affected platform: iOS, Android, web, or all.
- Steps to reproduce with synthetic data only.
- Expected and actual behavior.
- Any relevant app version, device, OS version, and build type.

Do not include real contraction logs, notes, phone numbers, pregnancy profile details, urgent events, or screenshots with private data.

## Privacy-Sensitive Areas

- Local SQLite database encryption and migration behavior.
- SecureStore keys and preferences.
- Share and PDF export flow.
- Logs, crash output, and development screenshot helpers.
- Any future network, account, analytics, or third-party SDK behavior.
