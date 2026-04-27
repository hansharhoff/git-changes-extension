# Git Remote Changes Alert

Git Remote Changes Alert makes missing remote Git commits much harder to miss in VS Code.

When the current branch is behind its upstream, the extension shows a red status bar item with a pull indicator and the number of commits available. When your current branch is not behind its own upstream but the default branch has moved ahead, it shows a warning status bar item so you can decide whether to merge or rebase the latest default branch changes.

## Features

- Shows a high-visibility status bar alert when the active repository's current branch has upstream commits to pull.
- Shows a warning when the default branch, such as `origin/main`, has commits that are not in your current branch.
- Click the status bar item to fetch remote refs and refresh the comparison.
- Works with the active editor's repository in multi-root workspaces.

## Settings

This extension contributes the following settings:

- `git-remote-changes-alert.defaultBranch`: Default branch to compare feature branches against. Leave empty to auto-detect the remote HEAD, then fall back to `origin/main` or `origin/master`.
- `git-remote-changes-alert.showWhenUpToDate`: Show a quiet status bar item even when there are no missing upstream or default branch commits.

## Commands

- `Git Remote Changes Alert: Refresh`: Recompute the current repository status from local Git refs.
- `Git Remote Changes Alert: Fetch and Refresh`: Fetch remote refs, then recompute the current repository status.

## Notes

The extension uses VS Code's built-in Git extension for repository discovery and falls back to the local `git` executable for branch comparisons. The default branch warning is based on fetched refs, so it is most useful when VS Code Git autofetch is enabled or after running the fetch command from the status bar.