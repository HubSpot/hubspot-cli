---
name: cli:code-check
description: Review code changes in current branch for adherence to team guidelines and conventions
disable-model-invocation: false
allowed-tools: Bash(git:*), Read, Grep, Glob
argument-hint: "[base-branch]"
---

# Code Style & Guidelines Checker

Review all code changes in the current branch to ensure they follow the team's coding standards, conventions, and organizational guidelines.

**Scope:** This skill focuses on architectural patterns, code organization, and conventions that require human judgment. Basic formatting (quotes, indentation, line length, trailing commas) should be checked with `yarn lint:local` and `yarn prettier:write`.

## Task

When this skill is invoked:

### 1. Run automated checks first

- Run `yarn lint:local` to catch formatting and linting issues
- Include these results in the review report to avoid duplicate concerns
- If linter fails, include the errors in the "Critical Issues" section

### 2. Identify changes to review

- Get the base branch to compare against (default: `main`)
- If an argument is provided (e.g., `/code-style-check develop`), use that branch as the base
- Use `git diff --name-only <base-branch>...HEAD` to get list of changed files
- Use `git diff <base-branch>...HEAD` to see the actual changes
- **Only analyze the specific lines that changed** - don't review entire files
- Ignore files in `node_modules/`, `dist/`, and other non-source directories

### 3. Review code against style guidelines

Check each modified file for compliance with these guidelines:

**Note:** This skill focuses on architectural patterns and conventions that require human judgment. Run `yarn lint:local` and `yarn prettier:write` for automated style checks (quotes, indentation, line length, etc.).

#### Code Quality & Patterns
- [ ] Descriptive variable names that clearly indicate purpose (avoid vague names like `data`, `info`, `temp`)
- [ ] Functional patterns preferred over classes
- [ ] Early returns for readability (avoid deep nesting)
- [ ] Appropriate use of `any` type (should be rare and well-justified)

#### TypeScript Organization
- [ ] Reusable/Exported type definitions in `/types` directory
- [ ] Proper type imports from type files
- [ ] No usage of `@ts-ignore` comments (use proper types or `@ts-expect-error` with explanation)

#### Project Organization
- [ ] Commands in `/commands/<domain>/<feature>.ts` structure
- [ ] Utilities in `/lib/<domain>/` directories
- [ ] Types in `/types/<domain>.ts` files
- [ ] User-facing strings in `/lang/en.ts` files (e.g., `/lang/en.ts`)
- [ ] UI components using Ink framework in `/ui/` directory (see [UI README](https://github.com/HubSpotEngineering/hubspot-cli-private/blob/main/ui/README.md))
- [ ] Tests in `__tests__` directories co-located with source
- [ ] Test files named `<source-file>.test.ts`
- [ ] File names use camelCase (not snake_case)

#### Logger and i18n
- [ ] All log statements use `uiLogger` (imported from `lib/ui/logger.js`)
- [ ] All user-facing strings defined in `/lang/en.ts`
- [ ] Logger import: `import { uiLogger } from '<path-to>/lib/ui/logger.js'` (adjust relative path as needed)
- [ ] Strings import: `import { commands } from '<path-to>/lang/en.js'` (adjust relative path as needed)
- [ ] Logger methods: `log()`, `error()`, `warn()`, `success()`, `info()`, `debug()`, `group()`, `json()`

#### Command Structure
- [ ] Commands export: `command`, `describe`, `builder`, `handler`
- [ ] Handler function calls `trackCommandUsage()` for analytics
- [ ] Use `exit()` only in command handler functions
- [ ] Exit codes from `lib/enums/exitCodes.ts`
- [ ] Description strings from `lang/en.ts`
- [ ] Type signature: `YargsCommandModule<T, U>` from `types/Yargs.ts`
- [ ] New commands use `verboseDescribe` for comprehensive `--help` text
- [ ] Command `builder` uses `makeYargsBuilder` utility with appropriate `use<X>Options` flags (e.g., `useAccountOptions`, `useEnvironmentOptions`)

#### Testing

**Unit/Integration Tests** (`__tests__` directories):
- [ ] Co-located with source code in `__tests__` directories
- [ ] Test files named `<source-file>.test.ts` (or `.test.tsx` for UI components in `/ui` directory)
- [ ] Use Vitest framework
- [ ] Test individual functions, modules, and their interactions
- [ ] Run with `yarn test`

**Acceptance Tests** (`/acceptance-tests` directory):
- [ ] Located in top-level `/acceptance-tests` directory (not co-located)
- [ ] End-to-end CLI tests that test full command execution
- [ ] Test the CLI as users would interact with it
- [ ] Run with `yarn test-cli`

**General Testing Rules:**
- [ ] No try/catch blocks in tests (use `expect().toThrow()` instead)
- [ ] Never skip tests (no `.skip()` or `xit()`)
- [ ] Never mock `lang/en.ts` file
- [ ] Tests must build successfully (`yarn build`)
- [ ] All tests must pass before merging

#### Dependencies and Breaking Changes
- [ ] Flag newly-added dependencies in `package.json` and challenge whether they're necessary
- [ ] Identify potential breaking changes (API changes, removed features, changed behavior)
- [ ] Recommend non-breaking implementation strategies (deprecation warnings, feature flags, backward compatibility)
- [ ] Document breaking changes clearly for users

#### Pull Request Size
- [ ] Prefer multiple smaller PRs over large ones for easier review
- [ ] If PR is large (>500 lines), suggest ways to break into smaller chunks
- [ ] Each PR should have a single, well-defined purpose

#### Git Practices
- [ ] No commits directly to `main` branch
- [ ] Changes are on a feature/fix branch

### 4. Generate the review report

Provide a structured report with these sections:

```markdown
# Code Style Review for Branch: <branch-name>

**Base:** <base-branch>
**Files Changed:** <count>

## Summary

_Brief overview of changes and overall code quality assessment (2-3 sentences)_

## Linter Results

**Status:** ✓ Passed / ✗ Failed

_If failed, include the relevant linter errors in the Critical Issues section below_

## Issues Found

### Critical Issues
_Issues that MUST be fixed before merging:_
- Linter/build failures
- Missing `trackCommandUsage()` call in command handler
- User-facing strings hardcoded instead of using `lang/en.ts`
- Using `process.exit`
- Using `exit()` outside of command handler function
- Test file that doesn't build
- Committing directly to `main` branch

- [ ] **<file-path>:<line>** - <description>
- [ ] **<file-path>:<line>** - <description>

### Pattern Violations
_Issues that violate codebase conventions and should be fixed before merging:_
- Type definitions in wrong place (not in `/types` directory)
- Not using `uiLogger` (using `console.log()` instead)
- Wrong directory structure (command file in wrong location)
- Missing tests for new functionality
- Try/catch in tests (should use `expect().toThrow()`)

- [ ] **<file-path>:<line>** - <description>
- [ ] **<file-path>:<line>** - <description>

### Suggestions
_Optional improvements that would enhance code quality:_
- Variable naming could be more descriptive (but not critically vague)
- Early return opportunities (when nesting is manageable)
- Refactoring opportunities for readability

- **<file-path>:<line>** - <description>

## Guideline Adherence

- [x] All user-facing strings in en.ts
- [x] Uses uiLogger for logging
- [x] Types defined in /types directory
- [x] Commands call trackCommandUsage()
- [x] Descriptive variable names
- [x] Proper file organization
- ...

## Files Reviewed

- `<file-path>` - <brief assessment>
- `<file-path>` - <brief assessment>

## Next Steps

**Before merging:**
1. Fix all Critical Issues (blocking)
2. Fix all Pattern Violations (maintain codebase standards)
3. Consider addressing Suggestions for code quality

_Additional specific recommendations based on the issues found_
```

### 5. Important constraints

- **Linter results are included** - since `yarn lint:local` runs first, include those results to avoid duplicate concerns
- Focus on architectural patterns and conventions that require human judgment
- Only analyze the specific lines that changed (from git diff), not entire files
- Be specific with file paths and line numbers for all issues
- Provide examples of correct patterns when flagging issues
- If no issues found, say so clearly and congratulate the team
- Don't flag auto-generated files (dist/, node_modules/)
- Be constructive and educational in tone
- Both Critical Issues and Pattern Violations should be fixed before merging
- Suggestions are optional improvements

### 6. Completion Format

**CRITICAL**: You MUST end your response with one of these exact status lines:

```
STATUS: PASSED - No issues found
```

or

```
STATUS: FAILED - [brief summary of critical issues]
```

This status line is used by automated workflows. Do not modify this format.

**Determining Status:**
- **PASSED**: No Critical Issues AND no Pattern Violations found (Suggestions only are still PASSED)
- **FAILED**: Any Critical Issues OR Pattern Violations found

### 7. Offer to fix issues

After presenting the review report and status line, if any issues were found, ask the user:

"Would you like me to fix any of these issues? If so, please tell me which specific items you'd like me to address."

Wait for the user to specify which issues to fix before making any changes. The user may:
- Ask you to fix all Critical Issues
- Ask you to fix specific items by file path or description
- Ask you to fix everything
- Decline and fix manually

Only make changes after receiving explicit consent and direction from the user.
