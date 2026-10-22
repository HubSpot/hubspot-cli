---
name: hubspot-fix-build
description: Diagnose and fix a failed HubSpot project build with the HubSpot CLI MCP tools. Use when a HubSpot project build failed, an `hs project upload` or `upload-project` failed, or a project deploy is blocked by a build error. Do not use it for other builds, such as npm, CI, or local compiler builds. Also use when `upload-project` returns a build failure. The skill finds the cause, fixes the project files, and asks before it uploads again.
disable-model-invocation: false
allowed-tools: Read, Grep, Glob
argument-hint: '[project-path] [build-id]'
---

# Fix a failed HubSpot project build

Use this skill to find why a build failed and to fix it. Work from the error text. Do not guess a cause.

The tools in this skill come from the HubSpot CLI MCP server, which `hs mcp setup` adds as `HubSpotDev`. If more than one server has a tool with the same name, use the one from `HubSpotDev`.

## Task

When this skill is invoked:

### 1. Locate the project

`get-build-status` and `get-build-logs` need the project path, even when you have a build ID. Find the project before you look at any build.

1. If the user passed a project path as an argument, use it.
2. Otherwise call `find-projects`. If it finds several projects, ask the user which one to use.
3. If the user passed a build ID, keep it for step 2. A build ID does not tell you which project it belongs to.

### 2. Find the failed build

1. Call `get-build-status` with no `buildId`. It shows the recent builds.
2. If the user named a build, use that build. Otherwise use the latest build with a failure status.
3. Call `get-build-status` again with that `buildId`. Read `buildErrorMessage` and the failed subbuilds.

If the latest build succeeded, tell the user. Ask which build they mean.

### 3. Read the logs only if needed

The status output often has enough detail. Call `get-build-logs` in these cases:

- The error message is vague or empty.
- The user asks about warnings.
- The subbuild failure does not name a file or a field.

Start with `logLevel` set to `ERROR`. Use `WARN` for warnings. Use `ALL` as the last choice.

### 4. Fix the cause

1. Name the cause to the user in one or two sentences. Quote the error text.
2. If the error points to a `*-hsmeta.json` file, read `platformVersion` in `hsproject.json`. Call `get-feature-config-schema` with that version and the `type` field from the file. Fix the file with values the schema allows.
3. For other errors, fix the named file.
4. Do not change `distribution` or `auth` in `app-hsmeta.json` to clear an error. These values cannot change after the first upload. Tell the user and ask what they want to do.
5. If you cannot find the cause, show the error text to the user without changes. Say which files and logs you read.

### 5. Validate

Call `validate-project`. Fix each error and call it again. Repeat until it passes.

### 6. Ask before you upload

Say what you changed. Ask the user whether to upload again. If they say yes, call `upload-project`. If the project uses profiles, ask the user which profile to use. Never choose a profile yourself.

After the upload, call `get-build-status` to read the status of the new build. If it fails again, go back to step 2. If the same error repeats after two fixes, stop and show the user the error and what you tried.
