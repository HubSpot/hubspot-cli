# PR Review Criteria — HubSpot CLI

Review criteria for all pull requests to this repository. Applies to human reviewers, AI-assisted review, and automated agents.

## Instant Approval Criteria

All of the following must be true for a confident approval:

- [ ] All user-facing strings are in `lang/en.ts`
- [ ] Tests exist for new functionality; all tests passing
- [ ] No `any` types (or justified with a comment explaining why)
- [ ] Error handling uses `logError()` + `EXIT_CODES` enum
- [ ] Command structure follows the 4-export pattern + `makeYargsBuilder`
- [ ] Tests are co-located in `__tests__/` directories
- [ ] No utility duplication (checked against `lib/`, `@hubspot/local-dev-lib`, `@hubspot/project-parsing-lib`)
- [ ] Uses `uiLogger` for all output (never `console.log`)
- [ ] JSON output uses `addJsonOutput()` (never direct `uiLogger.json()` in commands)
- [ ] `process.exit()` only in handlers, never in utilities
- [ ] PR description cites similar existing code (demonstrates look-first pattern)

## Blocking Issues (Request Changes)

Any of these require changes before merge.

### Hardcoded Strings

User-facing text must be in `lang/en.ts`, not inline in code.

**Violation:**
```typescript
uiLogger.error('Project not found');
```

**Correct:**
```typescript
uiLogger.error(commands.project.errors.notFound);
```

### Missing Tests

Every new or modified command/utility needs tests. For each changed `.ts` file in `commands/` or `lib/`, a corresponding test file must exist in `__tests__/`.

### Security Issues

- Path traversal vulnerabilities
- Command injection possibilities
- Credential exposure (secrets in logs or error messages)
- Unvalidated user input used in shell commands or file operations

### Reimplemented Existing Utilities

Code that duplicates functionality from `lib/`, `@hubspot/local-dev-lib`, or `@hubspot/project-parsing-lib`.

```bash
grep -r "functionName" node_modules/@hubspot/local-dev-lib --include="*.js" --include="*.ts"
grep -r "functionName" node_modules/@hubspot/project-parsing-lib --include="*.js" --include="*.ts"
```

See `AGENTS.md` for the full library placement decision tree.

### Wrong Error Handling

**Violation:**
```typescript
catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
```

**Correct:**
```typescript
catch (error) {
  logError(error, new ApiErrorContext({ accountId, request: 'upload' }));
  exit(EXIT_CODES.ERROR);
}
```

### Command Structure Violations

Commands must have exactly 4 exports and use `makeYargsBuilder`:

- `command` (string)
- `describe` (string imported from `lang/en.ts`)
- `builder` (using `makeYargsBuilder`)
- `handler` (async function)

### Direct uiLogger.json() in Commands

Commands must use `addJsonOutput()` from the handler args instead of calling `uiLogger.json()` directly. The wrapper handles JSON emission on exit.

**Violation:**
```typescript
if (formatOutputAsJson) {
  uiLogger.json(result);
}
```

**Correct:**
```typescript
addJsonOutput(result);
if (!formatOutputAsJson) {
  uiLogger.success(commands.myCommand.success);
}
```

### Numeric Exit Codes

Never use numeric codes directly. Always use `EXIT_CODES.SUCCESS`, `EXIT_CODES.ERROR`, etc. from `lib/enums/exitCodes.ts`.

### New Utils That Belong in External Libraries

If functionality could be reused by other HubSpot dev tools, it belongs in `@hubspot/local-dev-lib` or `@hubspot/project-parsing-lib`, not this repo's `lib/`.

## High-Risk Patterns — Flag for Human Review

These changes warrant a comment directing the human reviewer's attention even if no pattern violations are found:

- Changes to `bin/cli.ts`, `lib/yargsUtils.ts`, or authentication flows
- Changes to CI/CD configuration or release infrastructure
- New top-level commands (expands the public CLI surface)
- Major version bumps of external dependencies (`@hubspot/local-dev-lib`, `@hubspot/project-parsing-lib`)
- Breaking changes (changed behavior, removed flags, different output format) — verify PR description documents them

## Review Response Formats

**Approval:**

```
Approved - all patterns followed correctly. ✓

Verified:
- Strings in lang/en.ts ✓
- Tests passing + coverage ✓
- No utility duplication ✓
- Error handling correct ✓

Ready to merge after CI passes.
```

**Request changes:**

```
Request changes - pattern violations found:

**Blocking issues:**
1. [file:line] - Hardcoded string: "..."
   → Should be in lang/en.ts
   See: commands/project/upload.ts:89 for correct pattern

2. [file:line] - Function readConfigFile() duplicates @hubspot/local-dev-lib
   → Use: import { loadConfig } from '@hubspot/local-dev-lib'

**Additional resources:**
- Pattern guide: .claude/rules/COMMANDS.md
- Examples: [specific file:line references]
```
