---
name: cli:design-check
description: Design and refine HubSpot CLI commands, copy, and interaction patterns against established design guidelines and industry best practices (clig.dev, Heroku, Atlassian, HotCoA). Use when an engineer needs help with CLI design decisions — command/flag/arg structure, error messages, help text, prompts, success messages, warnings, progress output, configuration conventions, environment variables, interactivity patterns, naming, or accessibility. Trigger on "help me design this command", "review this CLI text", "write an error message for", "what should this prompt say", "how should I structure these flags", or any request about HubSpot CLI design, wording, tone, or behavior.
disable-model-invocation: false
allowed-tools: Read, Grep, Glob
argument-hint: '[surface-or-copy-to-review]'
---

# CLI Designer

Design and refine HubSpot CLI commands and copy to be human, guided, intuitive, and simple — the four HubSpot CLI design principles. Grounded in the consolidated [HubSpot CLI Design Standards](references/hubspot-cli-standards.md), which synthesizes clig.dev, the Heroku CLI Style Guide, Atlassian's 10 CLI Design Principles, the HotCoA CLI Design Guidelines, and HubSpot's internal design master doc.

## Workflow

### Step 1: Classify the Design Surface

Determine which type of CLI design work the engineer needs:

| Surface | Examples |
|---------|----------|
| **Command structure** | New command/subcommand hierarchy, naming, verb choice |
| **Flags and arguments** | Flag vs arg decisions, flag naming, boolean flags, defaults |
| **Error message** | Command failures, validation errors, permission issues |
| **Success message** | Confirmations after create/delete/upload/deploy |
| **Help text** | `--help` output, command descriptions, flag descriptions |
| **Prompt** | Interactive input requests (text, select, confirm) |
| **Warning** | Pre-action warnings, beta notices, destructive action confirms |
| **Progress output** | Spinners, step logs, deploy status |
| **Next-step suggestion** | Post-action recommendations |
| **Configuration** | Config file format, XDG paths, environment variables |
| **Interactivity** | TTY detection, stdin handling, interactive vs scripted modes |
| **Output design** | Human-readable vs machine-readable, `--json`, stdout/stderr separation |

If the surface type is unclear from context, ask:

> What type of CLI design help do you need? (command structure, flags/args, error message, help text, prompt, success message, warning, progress output, configuration, interactivity, output design, or something else)

### Step 2: Gather Context

Before designing or refining, understand:

1. **What command or feature is this for?** (e.g., `hs project deploy`, `hs sandbox create`)
2. **What is the user's state when they encounter this?** (e.g., mid-deploy, first-time setup, recovering from an error, writing a script)
3. **What should the user do next?** (e.g., fix a config, run another command, contact support)
4. **Will this be used interactively, in scripts, or both?** (affects flag design, prompting, output format)

If any of these are unclear, ask 1–2 targeted questions to keep momentum.

Example clarifying questions by surface:
- **Command structure**: "What existing `hs` commands is this related to? Will it have subcommands?"
- **Flags/args**: "How many inputs does this command take? Are any optional?"
- **Error**: "What caused this error, and what's the fix the user should take?"
- **Help text**: "Is this for the top-level `--help` or a specific subcommand?"
- **Prompt**: "What flag bypasses this prompt for scriptability?"
- **Success**: "Is there a natural next step after this action?"
- **Configuration**: "Is this per-project config or global user config?"
- **Output design**: "Will users pipe this output to other tools?"

### Step 3: Look at Existing HubSpot Patterns First

Before writing anything new, study how the codebase already does it. This catches inconsistencies before they ship and keeps the team's voice consistent.

For **copy** (errors, success, prompts, help text, descriptions):
- Search `lang/en.ts` for similar entries under nearby `commands.<name>` keys.
- Check `lib/ui/uiMessages.ts` for shared message patterns.
- Note the formatting helpers in use: `uiCommandReference()`, `uiLink()`, `uiAccountDescription()`, `uiAuthCommandReference()`, `uiBetaTag()`, `uiDeprecatedTag()`, `indent()` — these come from `lib/ui/index.ts` and copy should reuse them rather than reaching for `chalk` directly.
- Copy belongs in `lang/en.ts`, not in command files. The command handler imports `commands` from `lang/en.js` and passes the pre-formatted string to `uiLogger`.

For **command structure / flags / args**:
- Read 1–2 comparable existing commands under `commands/`. For example, if designing a new `hs account` subcommand, read all existing `account` subcommands.
- Note the patterns: how args are typed (`CommandArgs`), how the handler is structured, how errors are handled with `logError()`, how `trackCommandUsage()` is called early, how the builder uses `makeYargsBuilder()`.
- Flag/option `describe` values come from `lang/en.ts` under `commands.<name>.options.<flag>.describe`.

If you find inconsistencies between existing implementations, **stop and surface them** rather than silently picking one. Describe the discrepancy and ask which pattern to follow.

### Step 4: Apply the Standards and Refine

**Precedence rule**: When guidelines conflict, apply this order (highest first):

1. **hubspot-cli-standards.md** and **copy-patterns.md** — HubSpot's authoritative standards
2. **Existing codebase patterns** — what's already shipped in the HubSpot CLI
3. **Industry best practices** (clig.dev, Heroku, HotCoA) — supplementary only; this doc synthesizes the relevant parts already

Read [references/hubspot-cli-standards.md](references/hubspot-cli-standards.md) for the full standards reference covering principles, command structure, flags vs args, copy by surface, output, interactivity, accessibility, configuration, environment variables, robustness, future-proofing, and naming. All upstream sources (clig.dev, Heroku, Atlassian, HotCoA) have been synthesized in with HubSpot-specific overrides applied.

For copy work specifically, also read [references/copy-patterns.md](references/copy-patterns.md) for before/after examples — including real `lang/en.ts` examples from this codebase that show the team's actual voice.

Apply rules in order of priority:

1. **Actionable** — The user can act on it immediately. Errors say what to fix. Prompts say what to enter. Success says what to do next.
2. **Scannable** — Fits 80 chars wide. Key info is at the end (where the eye goes). Uses spacing, not walls of text.
3. **Consistent** — Same verbs, same patterns, same icon usage as existing `hs` commands.
4. **Human** — Written for a developer, not for a log parser. No raw JSON, stack traces, or internal IDs in default output.
5. **Scriptable** — Every prompt has a `--flag` bypass. Machine-readable output available via `--json`.
6. **Accessible** — Works with screen readers, supports `--no-color`, doesn't rely solely on styling for meaning.

### Step 5: Present the Recommendation

Use the format that fits the design surface:

**For copy refinements** (error messages, help text, prompts, success, warnings, progress):

```
**Surface**: [error message | help text | prompt | etc.]
**Command**: [hs command subcommand]

**Before** (if original was provided):
[original copy in a code block]

**After**:
[refined copy in a code block]

**lang/en.ts placement**:
[suggested key path, e.g., commands.project.upload.errors.uploadFailed]

**Why**: [1-2 sentences citing which guideline(s) drove the change]
```

**For structural design decisions** (command structure, flags/args, configuration, output, interactivity):

```
**Surface**: [command structure | flags/args | configuration | output design | interactivity]
**Command**: [hs command subcommand]

**Recommendation**:
[Design recommendation with examples in code blocks]

**Why**: [1-2 sentences citing which guideline(s) drove the recommendation]

**Alternatives considered** (if applicable):
[Brief note on what was ruled out and why]
```

When providing multiple options, label them A/B/C and state the tradeoff (e.g., "A is shorter but loses context; B is longer but more recoverable").

### Step 6: Check for Completeness

Use the lite checklist for single-piece copy refinements. Use the full checklist when designing or restructuring commands, configuration, or output.

#### Lite checklist — for individual copy passes (error, success, prompt, help, warning)

- [ ] Lives in `lang/en.ts` under the right `commands.<name>` key — not hardcoded in command code
- [ ] Uses `lib/ui` formatting helpers (`uiCommandReference`, `uiLink`, `uiAccountDescription`, etc.) instead of raw `chalk`
- [ ] Fits 80-character width, sentence case, no filler words ("successfully", "please")
- [ ] Errors say what failed AND how to fix it; recovery command is named explicitly
- [ ] Success messages confirm what happened in past tense, bold the entity, no exclamation points
- [ ] Prompts are directions (not questions), show the corresponding `--flag`, include defaults
- [ ] Icons used match the standard set and message still works without them

#### Full checklist — for command, flag, output, or config design

**Copy quality:**
- [ ] **Error messages** include what failed AND how to fix it
- [ ] **Help text** has description + usage + flags + at least one example
- [ ] **Prompts** show the corresponding `--flag` name and include a default when possible
- [ ] **Success messages** confirm what happened and suggest next steps (when appropriate)
- [ ] **Warnings** appear before the action, not after
- [ ] **Progress output** shows meaningful steps, not internal file-by-file detail
- [ ] **Next-step suggestions** only appear when there's a clear follow-up action
- [ ] **All copy** fits 80-character width, uses sentence case, and avoids filler words like "successfully" or "please"
- [ ] **Icons** match the standard set (checkmark=success, X=error, warning triangle=warning, ?=prompt, rocket=next steps)

**Command and flag design:**
- [ ] **Command naming** follows `hs <noun> <verb>` — singular nouns, consistent verbs across commands
- [ ] **Flags preferred over positional args** for multi-input commands; args only when singular and obvious
- [ ] **Flag names** are full words (`--location` not `--loc`), lowercase, kebab-case
- [ ] **Subcommands** are organized logically; related commands share consistent patterns
- [ ] **Builder uses `makeYargsBuilder()`** with appropriate global option flags (`useGlobalOptions`, `useAccountOptions`, etc.)
- [ ] **Tracking** — `trackCommandUsage()` is called early in the handler

**Output and scriptability:**
- [ ] **Scriptability** is preserved — confirmations have `--force`/`--yes` bypass
- [ ] **Table output is grep-parseable** — flat structure, no grouped section headers
- [ ] **Stdout/stderr separation** — data on stdout, progress/errors on stderr
- [ ] **`--json` available** for commands that output data (lists, status, info)
- [ ] **Colors** are used sparingly; yellow/red reserved for warnings/errors; output works with `--no-color`
- [ ] **Exit codes** use `EXIT_CODES.SUCCESS` / `EXIT_CODES.ERROR`; `process.exit()` only in handlers

**Interactivity and accessibility:**
- [ ] **Keyboard-first** — All interactions can be completed with keyboard only; shortcuts displayed prominently
- [ ] **Screen reader friendly** — Lists are numbered; plain-text alternatives for ASCII art; no styling-only meaning
- [ ] **Automation mode** — Destructive ops prompt by default with `--force`/`--yes` bypass; scripted ops skip prompts by default with `--interactive` to enable
- [ ] **TTY detection** — Behaves sensibly when stdin/stdout is not a terminal

**Configuration and robustness** (when applicable):
- [ ] **Config files** follow platform conventions (XDG on Linux, standard paths on macOS)
- [ ] **Environment variables** use a consistent prefix and naming scheme (match existing `HS_*` / `HUBSPOT_*` usage in the codebase)
- [ ] **Idempotency** — Repeating a command doesn't produce unexpected side effects
- [ ] **Backward compatibility** — Changes to GA commands don't break existing scripts

## i18n / lang/en.ts conventions

All user-facing copy lives in `lang/en.ts`, keyed by command and surface. The skill should always recommend a key path along with the copy itself.

### Key shape

The general structure is `commands.<commandName>.<surface>.<entry>`, where `<surface>` is one of:

- `describe` — the short command description
- `verboseDescribe` — the long-form description shown on `hs <command> --help`
- `options.<flagName>.describe` — flag description
- `examples.<exampleName>` — usage examples
- `errors.<errorName>` — error messages
- `success.<eventName>` — success messages
- `logs.<eventName>` — informational log lines
- `prompts.<promptName>` — interactive prompt text
- `subcommands.<sub>.…` — same shape, nested

For commands with subcommands (e.g. `hs account auth`), nest under `subcommands`:
```typescript
commands.account.subcommands.auth.errors.invalidAccountIdProvided
```

### Static strings vs. functions

- A flat string for fixed copy: `failedToUpdateConfig: 'Failed to update the configuration file. Please try again.'`
- An arrow function when interpolation is needed:
  ```typescript
  configFileCreated: (configPath: string) => `Created config file "${configPath}"`
  ```
- Type the parameters; don't use `any`.

### Formatting belongs in `lang/en.ts`, not the command

Use the `lib/ui` helpers inside `lang/en.ts` so the command file just reads pre-formatted strings:

```typescript
// lang/en.ts
import { uiCommandReference, uiAccountDescription } from '../lib/ui/index.js';

success: {
  configFileUpdated: (accountId: number) =>
    `Connected account ${uiAccountDescription(accountId)} and set it as the default account`,
}
```

```typescript
// commands/account/auth.ts
uiLogger.success(commands.account.subcommands.auth.success.configFileUpdated(accountId));
```

This keeps formatting logic centralized and testable; tests against `lang/en.ts` will catch unintended copy changes.

### What not to do

- Don't hardcode strings in command files (`uiLogger.error('Something failed')`).
- Don't reach for `chalk.bold` / `chalk.cyan` directly when a `lib/ui` helper exists.
- Don't mock `lang/en.ts` in tests — tests should detect string changes.

## Quick Reference: HubSpot CLI Principles

| Principle | In practice |
|-----------|------------|
| **Human** | Write for a person, not a machine. Empathy over efficiency. |
| **Guided** | Tell users the right next thing. Anticipate mistakes. |
| **Intuitive** | Same words and behaviors across all commands. |
| **Simple** | If it can be said in fewer words or fewer flags, do it. |

## Quick Reference: Common Fixes

| Problem | Fix |
|---------|-----|
| Raw backend error exposed | Catch and rewrite; offer `--debug` for full trace |
| "An error occurred" | State what specifically failed |
| No recovery path in error | Add "Run `hs ...` to fix" or link to docs |
| Question-style prompt | Rewrite as direction: "Enter X [--flag]:" |
| "Successfully created" | "Created **X**" (past tense, bold entity, no filler) |
| Wall of text output | Break into steps, use spacing, put action last |
| Missing `--force` bypass | Add flag for non-interactive use |
| Inconsistent verb | Match existing `hs` command vocabulary |
| Nested containers | Use flat structure with section headers and spacing |
| Styling-only meaning | Add bracket notation `[ERROR]`, `[OK]` for no-color mode |
| Hardcoded copy in command file | Move to `lang/en.ts`; import via `commands.<name>.…` |
| `chalk.bold` in `lang/en.ts` | Replace with the matching `lib/ui` helper if one exists |
