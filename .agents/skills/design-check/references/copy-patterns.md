# CLI Copy Patterns and Anti-Patterns

Before/after examples organized by copy surface area. Use these as the basis for refinement suggestions.

## Table of Contents

- [HubSpot CLI Examples (in-codebase)](#hubspot-cli-examples-in-codebase)
- [Error Messages](#error-messages)
- [Success Messages](#success-messages)
- [Help Text and Descriptions](#help-text-and-descriptions)
- [Prompts](#prompts)
- [Progress and Loading](#progress-and-loading)
- [Warnings and Confirmations](#warnings-and-confirmations)
- [Next-Step Suggestions](#next-step-suggestions)
- [Common Anti-Patterns](#common-anti-patterns)

---

## HubSpot CLI Examples (in-codebase)

Real examples from `lang/en.ts` showing how the team voices copy. Use these as the closest reference for tone before falling back to the generic patterns below.

### Error with recovery command (`hs account auth`)

```typescript
// lang/en.ts → commands.account.subcommands.auth.errors.migrationNotConfirmed
`Did not migrate your configuration file. Run ${uiAuthCommandReference()} to update your existing config, or use ${uiCommandReference('hs config migrate')} to switch to the new global configuration.`
```

What it does well:
- States what happened ("Did not migrate") in plain language without filler.
- Offers two specific recovery paths, each with the exact command to run.
- Uses `uiCommandReference()` for command formatting — not hardcoded backticks.
- Lives in `lang/en.ts`, not in the command handler.

### Success with bolded entity (`hs account auth`)

```typescript
// lang/en.ts → commands.account.subcommands.auth.success.configFileUpdated
(accountId: number) =>
  `Connected account ${uiAccountDescription(accountId)} and set it as the default account`
```

What it does well:
- Past tense for completed action.
- Bolds the entity via `uiAccountDescription()` (don't reach for `chalk.bold` directly).
- No "successfully" filler; no exclamation point.
- Tells the user the second-order effect ("set it as the default") so they know the new state.

### Error citing the source (`hs account use`)

```typescript
// lang/en.ts → commands.account.subcommands.use.errors.accountNotFound
(specifiedAccount: string, configPath: string) =>
  `The account "${specifiedAccount}" could not be found in ${configPath}`
```

What it does well:
- Quotes the exact value the user typed back at them.
- Names the source file the user can edit to fix it.
- One sentence; no decoration; the path is the most actionable bit and it's last.

### Anti-pattern still in the codebase

```typescript
// lang/en.ts → commands.account.subcommands.rename.success.renamed
(name, newName, nameWasSanitized) =>
  `Account "${chalk.bold(name)}" successfully renamed to "${chalk.bold(newName)}"${nameWasSanitized ? ' (Sanitized to remove invalid characters)' : ''}.`
```

Issues to flag if encountered:
- "successfully" is filler; past tense + checkmark already signals success.
- "(Sanitized to remove invalid characters)" reads like an internal log note; either explain what was sanitized or move the detail to a follow-up line.
- Uses `chalk.bold` directly instead of a `lib/ui` helper.

Refined:
```typescript
(name, newName, nameWasSanitized) =>
  `Renamed **${name}** to **${newName}**.${nameWasSanitized ? ` Invalid characters were removed from the new name.` : ''}`
```

---

## Error Messages

### Pattern: State what failed + how to fix it

BEFORE (raw backend error):
```
[ERROR] A StatusCodeError has occurred. 403 - {"status":"error","message":"You can't create/archive a development sandbox for portal 1687417.","correlationId":"fcffb457-23c6-4675-bfa7-b7abdc0b5c37","context":{"hubId":["1687417"]},"category":"BANNED","subCategory":"SandboxErrors.DEVELOPMENT_SANDBOX_ACCESS_NOT_ALLOWED"}
```

AFTER (human-readable):
```
Error: You don't have permission to create a development sandbox for this account.

Contact your account admin to enable sandbox access, or try a different account with `hs account use`.
```

### Pattern: Suggest the exact fix command

BEFORE:
```
Error: No project found in this directory.
```

AFTER:
```
Error: No project found in this directory.

Run `hs project create` to start a new project, or change to a directory that contains an `hsproject.json` file.
```

### Pattern: Group related errors

BEFORE:
```
Error: Missing required field "name" in app.json
Error: Missing required field "uid" in app.json
Error: Missing required field "scopes" in app.json
```

AFTER:
```
Error: app.json is missing 3 required fields:
  - name
  - uid
  - scopes

See https://developers.hubspot.com/docs/... for the full schema.
```

---

## Success Messages

### Pattern: Confirm what happened + suggest next step

BEFORE:
```
Done.
```

AFTER:
```
Created project **my-app** in ./my-app

Next step: run `hs project dev` to start local development.
```

### Pattern: Past tense for completed actions, bold the entity

BEFORE:
```
Your default account has been changed.
```

AFTER:
```
Default account changed to **my-sandbox**.
```

---

## Help Text and Descriptions

### Pattern: Verb-first, one line, under 75 characters

BEFORE:
```
This command allows you to create a new project from a template
```

AFTER:
```
create a new project from a template
```

### Pattern: Show usage + flags + example

BEFORE:
```
hs project create - Creates a project
```

AFTER:
```
create a new project from a template

Usage: hs project create [--name <name>] [--location <path>] [--template <id>]

Flags:
  --name        project name
  --location    directory to create the project in (default: current directory)
  --template    template to use

Example:
  $ hs project create --name my-app
```

---

## Prompts

### Pattern: Direction, not question; show the flag name

BEFORE:
```
What would you like to name your project?
```

AFTER:
```
Enter a name for your project [--name]:
```

### Pattern: Include defaults/suggestions

BEFORE:
```
Enter the project location:
```

AFTER:
```
Enter the project location [--location] (./my-app):
```
Pressing Enter accepts `./my-app`.

### Pattern: Validate immediately with actionable feedback

BEFORE:
```
Error: Invalid input
```

AFTER:
```
Project name must be lowercase letters, numbers, and hyphens only. Try again:
```

---

## Progress and Loading

### Pattern: Meaningful steps, not internal details

BEFORE:
```
Downloading...
Extracting...
Copying file 1 of 347...
Copying file 2 of 347...
...
Writing package.json...
Running npm install...
```

AFTER:
```
Creating app...
i Downloading template
i Registering app
i Creating environments
Created **my-app**
```

### Pattern: Spinner for indeterminate, steps for multi-phase

```
Deploying project to production...
  Uploading build                    [done]
  Running build                      [done]
  Provisioning serverless functions  [in progress]
```

---

## Warnings and Confirmations

### Pattern: Warn before destructive actions

BEFORE:
```
Deleting sandbox...
```

AFTER:
```
Warning: This will permanently delete sandbox **test-sandbox** and all its data.

Proceed? (y/N):
```

### Pattern: Support --force for scriptability

Interactive:
```
Warning: This will permanently delete sandbox **test-sandbox**.
Proceed? (y/N):
```

Non-interactive:
```
$ hs sandbox delete --name=test-sandbox --force
Deleted sandbox **test-sandbox**.
```

---

## Next-Step Suggestions

### Pattern: After successful creation, suggest the logical next action

```
Created project **my-crm-card** in ./my-crm-card

Next steps:
  cd my-crm-card
  hs project dev
```

### Pattern: In errors, suggest recovery commands

```
Error: Build failed. 2 type errors found.

Run `hs project dev` to see errors in watch mode, or check the build output above.
```

### Pattern: Don't suggest after every command

Only suggest next steps when:
- The user just completed a setup/creation action
- There's a clear, common follow-up in the workflow
- An error occurred and there's a recovery path

Do NOT suggest next steps after routine operations like `hs account list` or `hs project logs`.

---

## Common Anti-Patterns

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| Raw JSON/stack traces in default output | Overwhelming, not actionable | Catch and rewrite for humans; offer `--json` or `--debug` |
| "An error occurred" with no detail | Not actionable | State what failed and how to fix it |
| Walls of text | Users skim-read; important info gets buried | Break into chunks, use spacing, put actionable info last |
| Inconsistent verb usage across commands | Breaks intuition | Use the same verb for the same action everywhere |
| Exclamation points | Feels unprofessional or like shouting | Use periods or no punctuation |
| "Successfully" as filler | Adds no meaning; the checkmark/past tense already signals success | Remove it; `Created project **x**` > `Successfully created project x!` |
| Mixing question-style and direction-style prompts | Inconsistent UX | Pick directions as default style |
| Exposing internal/backend terminology | Confusing to users | Use user-facing language; translate internal concepts |
| Single-letter flags without long equivalents | Hard to discover and remember | Always provide `--full-name`; short alias is optional |
| Missing `--force` / `--yes` bypass for confirmations | Breaks scriptability | Every prompt must have a flag bypass |
