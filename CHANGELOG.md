# Change Log

All notable changes to the "git-remote-changes-alert" extension will be documented in this file.

## [0.0.3]

- Excluded `.env` files from VSIX packaging to prevent secret leakage.

## [0.0.2]

- Fixed refresh failures when remote HEAD symbolic refs are missing.
- Improved refresh error handling to avoid command-level crashes.
- Added installation guidance, roadmap ideas, and publish plan in the README.
- Corrected repository metadata URL.

## [0.0.1]

- Initial status bar alert for upstream commits to pull.
- Added default branch drift warning for feature branches.
- Added refresh and fetch-and-refresh commands.