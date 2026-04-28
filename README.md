# Git Remote Changes Alert

Git Remote Changes Alert makes missing remote Git commits much harder to miss in VS Code.

When the current branch is behind its upstream, the extension shows a red status bar item with a pull indicator and the number of commits available. When your current branch is not behind its own upstream but the default branch has moved ahead, it shows a warning status bar item so you can decide whether to merge or rebase the latest default branch changes.

## Features

- Shows a high-visibility status bar alert when the active repository's current branch has upstream commits to pull.
- Shows a warning when the default branch, such as `origin/main`, has commits that are not in your current branch.
- Click the status bar item to fetch remote refs and refresh the comparison.
- Works with the active editor's repository in multi-root workspaces.

## Installation

### Option 1: Install from VS Code Marketplace (after publish)

1. Open Extensions in VS Code.
2. Search for Git Remote Changes Alert.
3. Click Install.

### Option 2: Install from a VSIX file (available now)

1. Download or build the VSIX package.
2. In VS Code, open Command Palette.
3. Run Extensions: Install from VSIX....
4. Select the VSIX file.

### Option 3: Install with the CLI

```bash
code --install-extension git-remote-changes-alert-0.0.1.vsix --force
```

After installation, reload the window and open a Git repository to see the status bar signal.

## Settings

This extension contributes the following settings:

- `git-remote-changes-alert.defaultBranch`: Default branch to compare feature branches against. Leave empty to auto-detect the remote HEAD, then fall back to `origin/main` or `origin/master`.
- `git-remote-changes-alert.showWhenUpToDate`: Show a quiet status bar item even when there are no missing upstream or default branch commits.

## Commands

- `Git Remote Changes Alert: Refresh`: Recompute the current repository status from local Git refs.
- `Git Remote Changes Alert: Fetch and Refresh`: Fetch remote refs, then recompute the current repository status.

## Notes

The extension uses VS Code's built-in Git extension for repository discovery and falls back to the local `git` executable for branch comparisons. The default branch warning is based on fetched refs, so it is most useful when VS Code Git autofetch is enabled or after running the fetch command from the status bar.

## Roadmap Ideas

- Add status bar click actions menu, for example Pull, Fetch, and Open Source Control.
- Add branch-specific ignore rules for long-lived release branches.
- Add configurable severity and colors for upstream-behind versus default-branch drift.
- Add richer tooltip details with commit subjects and author/date summary.
- Add support for monorepo workflows with per-folder default branch settings.
- Add optional notifications when drift crosses a threshold.
- Add telemetry-free diagnostics panel to help users troubleshoot Git detection.
- Add integration tests covering real Git repositories and remote-edge cases.

## Plan To Publish In VS Code Marketplace

1. Prepare publisher and credentials.
	Create or confirm a VS Code publisher account and generate a Personal Access Token for publishing.
2. Install and sign in to the publishing tool.
	Install vsce and run publisher login with your publisher ID.
3. Final quality pass.
	Update README, CHANGELOG, icon, categories, keywords, and ensure npm run package and npm test pass.
4. Bump version.
	Increase package version using semantic versioning, then commit and tag.
5. Publish.
	Run vsce publish to upload the extension to Marketplace.
6. Verify listing.
	Confirm install works from Marketplace, check command visibility, and test in a clean VS Code profile.
7. Post-release maintenance.
	Track feedback, file issues, and schedule a first patch release for quick iteration.

Suggested release cadence:

- 0.0.2: publishable polish and UX refinements.
- 0.1.0: stable public release with better tests and docs.

## Vibecoding warning
This application was two-shotted with GPT-5.5
