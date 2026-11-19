# Release 8.19.0 [Minor]

Full commit diff can be found [HERE](https://github.com/HubSpot/hubspot-cli/compare/v8.18.0...main)

## Reasoning

This release is minor because it adds backwards-compatible behavior (new MCP setup tracking, shared CLI hints) and deprecates `hs init`, `hs auth`, and the CMS serverless function commands without removing them. The serverless create, server, and deploy commands stop working, but that follows the platform sunset of CMS serverless functions rather than a CLI-driven change. If you prefer to treat disabling commands as breaking, this could be argued as major.

## To be announced

- CMS serverless functions are being sunset. Creating them has ended, editing ends on November 17, 2026, and existing functions stop running on February 1, 2027. All `hs cms function` commands now print a deprecation notice that links to the Developer Changelog.
- `hs init` and `hs auth` are deprecated because the CLI is moving to global config. Use `hs account auth`, `hs account link`, and `hs config migrate` instead.
- `hs account create-override` and `hs account remove-override` are deprecated in favor of `hs account link` and `hs account unlink`.

## Notable changes

### Breaking Changes

- `hs cms function create` and `hs cms webpack create` are disabled and exit with an error, since serverless functions can no longer be created in the Design Manager.
- `hs cms function server` and `hs cms function deploy` are disabled and exit with an error on and after November 17, 2026 (UTC).
- The `create-cms-function` MCP tool is removed. Use the `add-feature-to-project` MCP tool to build serverless functions in a Developer Project.

### New Features

- `hs mcp setup` now records which clients were configured and which skills were installed.
- The MCP server tells agents to hand long-running dev commands, such as `hs project watch`, to the user instead of running them.
- `hs project upload --json` now includes skipped `hsmeta` files in its output.

### Bug Fixes

- Fixed `hs project upload` skipping files when the project path contains a dot directory.
- Fixed MCP tools failing to run CLI commands on Windows, and stopped free text from being turned into `hs` flags.
- Account names containing spaces are now rejected during account auth, with a clear error.
- Preview failure messages no longer include misleading retry and project UI advice.
- `hs cms upload` and `hs cms watch` now explain the serverless sunset when a file in a `.functions` folder is rejected.

### Improvements and Refactoring

- Added a shared hint mechanism for CLI promotion messages, with throttling so hints are not shown too often.
- Every CMS serverless command option is tagged as deprecated in help output.
- Removed two circular dependencies in the UI and app code, and renamed UI helper functions for consistency.
- Replaced the review skills with a shared `.ai/REVIEWING.md` guide.
- Updated external dependencies.
