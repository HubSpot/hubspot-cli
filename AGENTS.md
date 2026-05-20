# HubSpot CLI Agent Instructions

This repository is HubSpot's Node.js command line tool for developers building
on the HubSpot platform.

## Stack

- Language: TypeScript in strict mode, ESM modules
- CLI framework: Yargs
- Package manager: Yarn
- Tests: Vitest, not Jest
- Build: `yarn build`
- Lint: `yarn lint:local`
- Format: `yarn prettier:write`

Do not use Java, Maven, CHIRP, Bend, Trellis, or HubSpot backend/frontend
platform workflows for normal work in this repo.

Internally owned dependencies may be relevant to CLI behavior:

- `@hubspot/project-parsing-lib`: parsing project files and generating
  intermediate representations
- `@hubspot/local-dev-lib`: reusable API calls, config loading, and local
  development utilities

## Start Here

Before creating or modifying code, study how the repo already does the same
kind of work.

- Search for similar files and read at least two comparable examples before
  adding a new file.
- Check `lib/` before adding a new utility.
- Check `@hubspot/local-dev-lib` before reimplementing reusable HubSpot CLI or
  local development behavior.
- Check `types/` before adding a new shared type.
- If existing implementations disagree in a meaningful way, stop and surface
  the discrepancy instead of silently choosing one pattern.

## Command Work

When creating or modifying commands:

- Put user-facing strings in `lang/en.ts`, not command files.
- Use `uiLogger` from `lib/ui/logger.ts` for command output.
- Use `logError()` from `lib/errorHandlers/` for handled errors.
- Call `trackCommandUsage()` early in command handlers.
- Use `makeYargsBuilder()` from `lib/yargsUtils.ts`.
- Use the `exit()` function passed to command args. Do not call
  `process.exit()` directly.
- Keep `exit()` calls in command handlers. Utilities should throw or return
  useful data.
- Add or update co-located tests in `__tests__/`.

For detailed command guidance, read `.claude/rules/COMMANDS.md` before editing
files under `commands/`.

## Code Style

- Prefer functions over classes.
- Use early returns to keep control flow readable.
- Use descriptive variable names.
- Do not introduce `any` unless there is a narrow, well-justified reason.
- Do not add comments unless the code would otherwise be hard to follow.
- Follow the repo formatter for single quotes, 2-space indentation, trailing
  commas, and line length.
- Do not use the word `comprehensive` in repo copy or generated docs.

## Copy And Output

- Keep CLI copy in `lang/en.ts`.
- Format strings in `lang/en.ts` using helpers from `lib/ui/index.ts` such as
  `uiLink`, `uiCommandReference`, `uiAuthCommandReference`, `uiBetaTag`,
  `uiDeprecatedTag`, and `indent`.
- Check `lib/ui/uiMessages.ts` for reusable message patterns.
- Command files should pass preformatted strings to `uiLogger`.

For detailed copy guidance, read `.claude/rules/COPY.md` before editing
`lang/en.ts` or command output.

## Tests

- Tests live in co-located `__tests__/` directories.
- Test files are named after the file under test.
- Use Vitest globals and existing mocks from `vitest.setup.ts`.
- Do not mock `lang/en.ts`.
- Do not use try/catch in tests. Use `expect().toThrow()`.
- Do not skip tests.

For detailed test guidance, read `.claude/rules/TESTS.md` before editing tests.

## Validation

After code changes, run the smallest useful validation set:

1. `yarn prettier:write`
2. `yarn build`
3. `yarn test <path>` for changed or closely related tests

Run broader checks when the change touches shared behavior or command
framework code.

## Git And PR Workflow

- Do not amend commits on an existing PR unless the user explicitly asks for an
  amend, rebase, squash, or history rewrite.
- When addressing review feedback on a PR, create a new follow-up commit by
  default.
- For stacked PRs, prefer merging parent branch updates into the child branch
  over rebasing, because PRs are squash-merged into `master`.
- Ask before committing, pushing, force-pushing, creating PRs, posting comments,
  merging, closing, or otherwise mutating GitHub state.

## Public Writing

When drafting public GitHub issue comments, PR descriptions, release notes,
community replies, or public Slack messages:

- Be short, direct, and warm.
- Thank or acknowledge the reporter before giving the substance.
- Avoid apology openers, process narration, and em dashes.
- Use "please" when asking the reporter to do something.

For detailed public-writing guidance, read `.claude/rules/PUBLIC_WRITING.md`.

## Shared Skills

Portable project skills are exposed under `.agents/skills/`. When a task
matches one of these workflows, read that skill before proceeding:

- `code-check`: review branch changes against repo conventions.
- `design-check`: design or refine CLI commands, flags, prompts, help text,
  errors, success messages, warnings, progress output, and other CLI UX.
- `create-changelog`: generate an npm release changelog from commits.

Claude-specific skills and orchestration workflows may still live only under
`.claude/skills/`.

## Agent-Specific Config

`AGENTS.md` is the canonical behavioral entry point. Agent-specific permission
or runtime configuration should stay in that agent's own local config, such as
`.claude/settings.local.json` for Claude or `.codex/rules/*.rules` for Codex
command execution policy. Do not duplicate behavioral rules into permission
files.
