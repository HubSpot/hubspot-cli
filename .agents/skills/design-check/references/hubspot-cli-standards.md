# HubSpot CLI Design Standards

The single source of truth for designing HubSpot CLI commands, flags, copy, output, and interaction. Synthesized from the HubSpot CLI Design Guidelines Master Doc, the Heroku CLI Style Guide, Atlassian's 10 CLI Design Principles, the Command Line Interface Guidelines (clig.dev), the HotCoA CLI Design Guidelines, and benchmark patterns from Shopify, Stripe, and Vercel.

## Table of Contents

- [Design Principles](#design-principles)
- [Command Structure](#command-structure)
- [Flags vs Arguments](#flags-vs-arguments)
- [Copy by Surface Area](#copy-by-surface-area)
- [Style Rules](#style-rules)
- [Formatting and Visual Hierarchy](#formatting-and-visual-hierarchy)
- [Icons and Symbols](#icons-and-symbols)
- [Output: Stdout, Stderr, Machine-Readable](#output-stdout-stderr-machine-readable)
- [Colors](#colors)
- [Interactivity and Prompting](#interactivity-and-prompting)
- [Accessibility](#accessibility)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Robustness](#robustness)
- [Future-Proofing](#future-proofing)
- [Naming](#naming)
- [Benchmark Patterns](#benchmark-patterns)

---

## Design Principles

### HubSpot's four CLI principles

1. **Human** — Human-first design. Write with empathy. Keep developers informed about what's happening and what to expect.
2. **Guided** — Opinionated and directional. Help developers do the right next thing. Anticipate mistakes so they can keep moving confidently.
3. **Intuitive** — Consistent language and behavior. Reduce cognitive overload and strengthen intuition. Follow existing patterns.
4. **Simple** — Consider the essential and eliminate unnecessary input/output. Easy to understand, learn, and remember.

### Industry principles that reinforce HubSpot's

From clig.dev, Heroku, Atlassian, and HotCoA:

- **Say (just) enough** — Too little and the user wonders if it's broken; too much and the important thing drowns.
- **Conversation as the norm** — The CLI is a dialogue. Error → correction → retry is a conversation. Write copy that participates in it.
- **Ease of discovery** — Help text, error suggestions, and next-step hints replace the discoverability GUIs get for free.
- **Empathy** — Give the user the feeling that you are on their side. Delight comes from exceeding expectations at every turn.
- **Robustness** — Software should *be* robust (idempotent where possible, graceful with bad input) and *feel* robust (responsive, doesn't print scary stack traces, keeps the user informed).
- **Consistency across programs** — Where possible, follow patterns that already exist in the wider terminal ecosystem. Break with convention only when it demonstrably hurts users.

---

## Command Structure

HubSpot CLI follows: `hs <noun> <verb> [--flags]`

| Part | Rule | Example |
|------|------|---------|
| Root | Always `hs` | `hs` |
| Command | Singular noun | `project`, `sandbox`, `account` |
| Sub-command | Verb describing the action | `create`, `delete`, `upload`, `dev` |
| Flags | `--full-word` preferred; short single-letter only when very frequent | `--name`, `--account`, `-d` for `--debug` |

Key rules:

- **Singular nouns** for commands (`project` not `projects`). Plural aliases are OK for ergonomics (`hs projects dev` aliases `hs project dev`).
- **Short, meaningful verbs** (`dev`, not `development`).
- **Consistent verbs across commands** — `create` everywhere, not `create` in one place and `build` in another.
- **Single lowercase word** for command and subcommand names; use kebab-case only when multiple words are unavoidable (`create-override`).
- **Standard flag names** when applicable: `--account`, `--name`, `--format`, `--debug`, `--json`.
- **Explicit `list` subcommands** — HubSpot uses `hs project list`, `hs account list`, etc. Root commands require a subcommand via `demandCommand(1)` and show help when invoked alone.
- **`noun verb` ordering** is the standard at HubSpot (also more common across CLIs in general). Be consistent with verbs across object types.
- **No ambiguous or near-duplicate command names** — `update` and `upgrade` side by side is confusing.
- **No catch-all subcommands and no abbreviation aliases** — once `i` aliases `install`, you can never add another command starting with `i`. Aliases should be explicit and stable.

### Subcommands

When a tool gets large enough to need subcommands:

- **Be consistent across subcommands** — same flag names for the same things, same output formatting.
- **Use consistent verbs across object types** — if you have `hs project create` and `hs sandbox create`, don't introduce `hs account new`.

---

## Flags vs Arguments

**Flags are preferred to args.** They involve more typing but make CLI use clearer.

Confusing (positional args):
```
$ hs fork destapp -a sourceapp
```

Clear (flags):
```
$ hs fork --from sourceapp --to destapp
```

**Why flags win:**

- Users can specify them in any order.
- Users gain confidence they're running the command correctly.
- Better error messages are possible.
- Autocomplete works better.
- Future input can be added without breaking existing usage.

**When args are acceptable:**

- There is only 1 argument and it's obvious in context (e.g., `hs project release v1.0.0`).
- The action is industry-standard with an obvious order (`hs upload <src> <dest>`).
- Multiple args are fine for simple actions over multiple files (`rm a.txt b.txt`), where globbing is also useful.

**Flag rules:**

- Always provide a full-length version of every flag (`-h` and `--help`, never just `-h`).
- Use one-letter flags only for the most common ones, especially at the top level — don't pollute the short-flag namespace.
- Provide descriptions for all flags. Lowercase, concise, no trailing period.
- Don't read secrets directly from flags — use a `--password-file` or stdin to avoid leaking into `ps` output and shell history.
- Where possible, make flag/arg/subcommand order independent so users can hit `<up>` and append a flag.

### Standard flag names (use these when they apply)

- `-a`, `--all` — apply to all
- `-d`, `--debug` — verbose/debug output
- `-f`, `--force` — bypass confirmations
- `-h`, `--help` — help (don't overload)
- `--json` — JSON output
- `-n`, `--dry-run` — describe what would happen
- `--no-input` — disable all prompts
- `-q`, `--quiet` — suppress non-essential output
- `--version` — version info

---

## Copy by Surface Area

### Help text (`--help`)

- Description of what the command does (1 sentence).
- Usage pattern with arguments and flags.
- List of flags with short descriptions.
- 1–2 examples showing common usage.
- Link to docs for more detail.
- Most common commands/flags listed first.
- HubSpot help layout order: Description > Usage > Flags > Examples > Docs link. Examples come after flags, not first (diverges from clig.dev's "lead with examples" advice).
- Use bold section headers; do it in a terminal-independent way so users don't see escape characters.
- For `git`-style tools, all of these should show help: `hs subcommand --help`, `hs subcommand -h`, `hs help subcommand`.
- If a command requires arguments and is invoked with none, display concise help (description + 1–2 examples + flag list) rather than just erroring.

### Command descriptions (in help listings)

- Max ~50–75 characters; fits an 80-char screen.
- Start with a lowercase verb (POSIX convention).
- Describe the action, not the implementation.
- No trailing period on single-sentence descriptions.
- ✅ `create a new project`
- 🚫 `runs the project creation wizard and scaffolds files`

### Prompts (interactive input)

- Structure as **directions**, not questions, when possible.
- ✅ `Enter a name for your project [--name]:`
- 🚫 `What would you like to name your project?`
- Show the corresponding flag in the prompt text so users learn the non-interactive path.
- Include a default/suggestion when possible; pressing Enter accepts it.
- Validate input immediately; show an actionable error if invalid.
- Never *require* a prompt — every prompt must be bypassable with a flag or arg, or the command becomes unscriptable.
- Don't echo passwords as the user types.
- If `stdin` isn't a TTY, skip prompting and require flags/args instead.

### Success messages

- Confirm what happened in past tense.
- Bold the key entity (project name, account name).
- Suggest the next step when there's a common follow-up flow.
- Keep to 1–3 lines.
- Drop filler words like "successfully" — `Created **my-app**` beats `Successfully created my-app!`.

### Error messages

- State what went wrong in plain language.
- Suggest how to fix it (specific command, flag, or action).
- Include a docs link when relevant.
- Never expose raw stack traces, correlation IDs, or HTTP status codes in default output. Offer `--debug` for the full trace.
- Structure: `[icon] What failed.` then `How to fix it.`
- Group multiple errors of the same type under one header rather than printing many similar lines.
- Put the most actionable information **last** — that's where the eye is drawn.
- If you can guess what the user meant (typo correction), suggest it but don't auto-run it. ("Did you mean `ps`? [y/n]")
- For unexpected failures, write debug info to a file rather than dumping it on the user, and provide a one-line "submit a bug" hint.

### Warning messages

- Use sparingly, for things the user should know before proceeding.
- Reserve for beta features, destructive actions, important context.
- Confirm before destructive actions (`y/N` with `--force` bypass).

### Progress / loading output

- Use spinners for indeterminate tasks.
- Break long-running tasks into meaningful steps.
- Show step completion with checkmarks.
- Don't show every internal file-by-file step; show what matters to the user.
- Action commands (Heroku pattern): `Enabling maintenance mode for myapp... done`
- Print *something* in <100ms — a long silence makes the program feel broken.
- For multi-stage operations (e.g., docker pull), parallel progress indicators are great, but make sure logs aren't lost when something fails.
- Make progress timeout-able. Hangs with no estimate are worse than failures.
- Place human-readable summaries **after** structured output — messages placed before output auto-scroll away.

### Next-step suggestions

- Show after relevant commands where there's a clear follow-up.
- Don't show after every command. Routine ops like `hs account list` don't need them.
- Format: short description + the exact command to run.
- Use in errors too: suggest commands that help recover.

---

## Style Rules

### Voice and tone

- Second person (`you`, `your`) or imperative (implied `you`).
- Present tense for current state, past tense for completed actions.
- Active voice always.
- Direct and concise; no filler words.
- No marketing language; no exclamation points unless truly celebratory.
- Technical but approachable — assume a developer audience but not HubSpot expertise.

### Length

- Help descriptions: 1 sentence, ~50–75 chars.
- Error messages: 1–3 sentences.
- Success messages: 1–2 sentences.
- Prompt labels: as short as possible while remaining clear.
- CLI output should fit 80-char screens when possible.

### Capitalization

- Sentence case for all messages and descriptions.
- Don't capitalize flag names, command names, or technical terms mid-sentence.
- Capitalize proper nouns (HubSpot, GitHub) and the first word of sentences.

### Punctuation

- No trailing periods on single-sentence help descriptions.
- Use periods in multi-sentence messages.
- No Oxford comma required, but be consistent within a command.

---

## Formatting and Visual Hierarchy

- **Bold** for labels, table headers, project/account names in long output. Don't overuse — bold loses meaning when everything is bold.
- Use spacing and indentation for visual structure.
- Reference other commands using `uiCommandReference()` from `lib/ui/index.ts`, which renders in `UI_COLORS.MARIGOLD_DARK` (#dbae60). Do not use `chalk` directly for command references.
- Hyperlinks using `uiLink()` from `lib/ui/index.ts`, which renders in `chalk.cyan` with terminal hyperlink support where available. Do not hardcode link styling.
- Break output into digestible chunks; avoid walls of text.
- Tables and lists for structured data.
- Don't rely on styling alone — italic may render as blink in some terminals, bold may render as a brighter color, hyperlinks display inconsistently across terminals and SSH sessions. Provide plain-text fallbacks.

---

## Icons and Symbols

HubSpot CLI uses a consistent, minimal icon set:

| Icon | Meaning | Usage |
|------|---------|-------|
| Checkmark | Success / completed step | After successful actions |
| X / cross | Error / failure | Error messages |
| Warning triangle | Warning | Before destructive actions, beta notices |
| Info (i) | Informational | Non-critical context during execution |
| Spinner | In progress | During async operations |
| Rocket | Next steps | Suggested next steps after a command |
| Question mark (?) | Prompt | Before interactive prompts |

Rules:

- Icons enhance meaning, never convey it alone — the message must work without the icon.
- Use icons consistently across commands to build pattern recognition.
- Never use emojis in error messages.
- All icons must be Unicode symbols (terminal-safe).
- Use emojis sparingly — to add character, not clutter. Be mindful of cultural sensitivity (avoid hand gestures).
- For no-color modes, use bracket notation: `[ERROR]`, `[OK]`, `[WARN]`.

---

## Output: Stdout, Stderr, Machine-Readable

Terse, machine-readable output should never compromise beautiful human-readable output. Offer both.

### Stdout vs stderr

- **Stdout** — primary data output (what the user asked for). All machine-readable output goes here, since piping sends stdout by default.
- **Stderr** — warnings, errors, spinners, progress, and out-of-band info.
- This separation lets users pipe stdout to files/tools without noise from progress indicators.
- Don't treat `stderr` like a log file by default — no `ERR`/`WARN` log-level prefixes unless in verbose mode.

### Exit codes

- Return zero on success, non-zero on failure.
- Map non-zero codes to the most important failure modes (use `EXIT_CODES` enum in this codebase).

### Grep-parseable tables

Human-readable list/table output should be grep-parseable. Use flat tables with consistent column alignment, not grouped sections with headers.

Bad (not grep-parseable):
```
Production
==========
my-app     Running
my-api     Running

Staging
=======
my-app     Stopped
```

Good (grep-parseable):
```
Name       Status   Environment
---------  -------  -----------
my-app     Running  Production
my-api     Running  Production
my-app     Stopped  Staging
```

### `--json` output

Use `--json` for detailed machine-readable output. This allows scripting with `jq`:
```
$ hs project release list --json | jq -r '.[].tag'
```

### Backward compatibility

After a command reaches GA, do not change its stdout in ways that break existing scripts. Adding new fields is OK; modifying or removing existing output is not. The HubSpot CLI does not have a `--plain` flag; only `--json` (hidden) is available for machine-readable output.

### TTY-aware behavior

- Detect whether stdout/stderr is a TTY and adapt: no spinners or animations when piped, no colors when not interactive.
- If a command expects piped input and `stdin` is a TTY, display help and quit rather than hanging like `cat`.

### Display output on success

UNIX tradition is to print nothing on success, but for human-facing CLIs that often makes commands feel broken. Err on the side of less, but say *something* meaningful. Provide `-q`/`--quiet` for callers who want silence in scripts.

### When you change state, tell the user

After mutating remote or local state, confirm what changed so the user can model the new state. `git push`'s output is the canonical example.

---

## Colors

The HubSpot CLI defines its color palette in `lib/ui/index.ts` as `UI_COLORS`:

| Constant | Hex | Usage |
|----------|-----|-------|
| `MARIGOLD_DARK` | `#dbae60` | Command references via `uiCommandReference()` |
| `SORBET` | `#FF8F59` | Reserved (currently unused; defined for future use) |
| `MARIGOLD` | `#f5c26b` | Reserved (currently unused; defined for future use) |

Links use `chalk.cyan` via `uiLink()`.

Rules:
- Use `lib/ui` helpers (`uiCommandReference`, `uiLink`) rather than `chalk` directly. This keeps color usage consistent and centralized.
- Be sparing — too many contrasting colors compete for attention. A couple of colors plus dim/bolding provides enough contrast.
- Yellow and red are reserved for warnings and errors.
- New colors must have a minimum 4.5:1 contrast ratio for accessibility.
- Color must be disableable: respect `--no-color`, `NO_COLOR` env var, `COLOR=false`, `TERM=dumb`, and non-TTY environments.
- For no-color modes, use bracket notation: `[ERROR]`, `[OK]`, `[WARN]` so meaning survives without styling.

---

## Interactivity and Prompting

### Automation-mode strategies

Two valid strategies; pick based on operation safety vs automation frequency:

| Strategy | When to use | How |
|----------|-------------|-----|
| **Prompt by default, skip with flags** | Destructive operations, infrequent commands | `--force`, `--yes`, `-y` to bypass |
| **No prompts by default, enable with flags** | Frequently scripted commands | `--interactive`, `--confirm` to enable |

### Confirmation by danger level

- **Mild** (delete a file): may or may not prompt; if the command is named `delete`, prompting is often unnecessary.
- **Moderate** (delete a directory, delete a remote resource): prompt for confirmation; consider offering `--dry-run`.
- **Severe** (delete an entire app, server, or production resource): make it hard to confirm by accident — require typing the resource name. Provide `--confirm="name-of-thing"` for scripts.

### Hard rules

- Every prompt must be bypassable via a flag or arg — otherwise the command can't be scripted.
- If `--no-input` is passed, don't prompt or do anything interactive.
- If `stdin` is not a TTY, skip prompting and require flags.
- Don't echo passwords as the user types.
- Make Ctrl-C work even during clean-up. If the program wraps something where Ctrl-C is captured, document the escape sequence.

### Interaction surfaces (HotCoA)

Three primary patterns for interactive output:

- **Inline** — embedded in the command flow. Best for command completion, quick confirmations. Default for most CLI interactions.
- **Side panel** — split-screen alongside main interface. For real-time monitoring or AI assistance.
- **Alternate buffer** — full-screen takeover. For complex interactive apps (vim, htop). Rare in HubSpot CLI.

---

## Accessibility

### Keyboard-first

- All interactions must be completable with the keyboard alone.
- Display keyboard shortcuts prominently alongside any clickable actions.
- Conventional bindings: `E` Edit, `C` Copy, `R` Run; arrows for navigation; Tab/Shift+Tab for movement; 1–9 for numbered selection.

### Selection interfaces

- Always **number list items** — screen readers need numbered references to identify positions.
- Show all items upfront for small lists (~25 or fewer); avoid pagination.
- Support multiple selection methods: arrow keys, number entry, spacebar toggles.

### Screen readers

- Whatever appears on screen is exactly what will be read aloud.
- Provide plain-text alternatives for ASCII art.
- Detect screen readers and skip art when active.
- Show ASCII art only on special occasions (first run, major upgrades).

### No-color and no-styling modes

- Support `NO_COLOR`, `--no-color`, and `TERM=dumb`.
- Use bracket notation like `[ERROR]`, `[OK]` so meaning survives without color.
- Don't rely on styling to convey critical info — visible-by-default plain content first, styling on top.

### Multiple access methods

- Provide alternatives for hyperlinks (links + command alternatives + URLs) since terminal hyperlink support varies.
- Test in minimal environments: Command Prompt, basic Linux terminals, SSH sessions.

---

## Configuration

Config falls into three categories with three different storage strategies:

| Type | Examples | Recommendation |
|------|----------|----------------|
| Varies per invocation | Debug level, dry-run | Flags |
| Stable per machine/user | HTTP proxy, color preferences, default account | Flags + env vars (often in shell profile) |
| Stable per project, all users | `hsproject.json`, `package.json` | Version-controlled file |

### Rules

- **Follow XDG Base Directory Spec** on Linux for config locations (`~/.config/hs/`, etc.). Use platform conventions on macOS/Windows.
- **Apply config in precedence order** (highest to lowest): flags → shell env vars → project config → user config → system config.
- **If you modify config that isn't your program's**, ask consent and tell the user exactly what you're doing. Prefer creating a new file (`/etc/cron.d/myapp`) over appending to an existing one.

---

## Environment Variables

- Env vars are for behavior that **varies with the context** in which a command is run.
- Names must be uppercase letters, numbers, and underscores only; can't start with a number.
- Aim for single-line values — multi-line values break `env`.
- Don't commandeer widely-used names. Check the [POSIX standard env vars list](https://pubs.opengroup.org/onlinepubs/009695399/basedefs/xbd_chap08.html).
- Honor general-purpose env vars when applicable: `NO_COLOR`, `FORCE_COLOR`, `DEBUG`, `EDITOR`, `HTTP_PROXY` family, `TERM`, `TMPDIR`, `HOME`, `PAGER`, `LINES`, `COLUMNS`.
- Use a consistent prefix for HubSpot-specific vars (e.g., `HS_*` or `HUBSPOT_*` — match what already exists in the codebase).
- **Don't read secrets from env vars** — they leak via process inspection, logs, and `docker inspect` / `systemctl show`. Use credential files, pipes, or secret management instead.
- Read from `.env` for project-specific overrides where appropriate, but don't use `.env` as a substitute for a real config file.

---

## Robustness

- **Validate user input.** Bad data will reach you eventually — fail early with an understandable error.
- **Be responsive, not necessarily fast.** Print *something* within 100ms. Show progress for anything that might take a while.
- **Make things time out** — don't hang forever on network calls. Allow the timeout to be configured.
- **Make it recoverable** — `<up><enter>` should pick up where the user left off when something transient fails.
- **Make it idempotent / crash-only** where possible. Repeating a command shouldn't produce surprising side effects.
- **People will misuse your program** — be prepared. They'll wrap it in scripts, run multiple instances, hit it on bad networks. Defensive design pays off.

### Signals

- On Ctrl-C (INT), exit as soon as possible. Acknowledge immediately, before clean-up. Add a timeout to clean-up so it can't hang.
- If the user hits Ctrl-C *during* clean-up, skip remaining steps and tell them what will happen if they hit it again.

---

## Future-Proofing

Subcommands, flags, configuration files, and env vars are all interfaces. You're committing to keeping them working.

- **Keep changes additive** — add new flags rather than changing the meaning of existing ones.
- **Warn before non-additive changes.** When deprecating a flag, tell users in-band when they use it. Tell them how to migrate. Detect when they have, and silence the warning.
- **GA stdout is a stable contract.** After a command reaches GA, do not change human-readable stdout in ways that break existing scripts. Scripts should use `--json` for machine-readable output. (The HubSpot CLI has no `--plain` flag.)
- **Don't have a catch-all subcommand** — once `mycmd echo` works as `mycmd run echo`, you can never add an `echo` subcommand.
- **Don't allow arbitrary subcommand abbreviations.** If `mycmd i` aliases `install`, you've blocked off everything else starting with `i`. Aliases should be explicit and stable.
- **Don't build a time bomb** — don't depend on external services that may disappear in 20 years.

---

## Naming

For the program name itself:

- Simple, memorable word — but not so generic it collides (Windows and ImageMagick both shipped `convert`).
- Lowercase only. Dashes if absolutely necessary. `curl` good; `DownloadURL` bad.
- Short, but not *too* short — single-letter and two-letter names are reserved for ubiquitous utilities (`cd`, `ls`, `ps`).
- Easy to type. Stick to one hand isn't great; bouncing between hands is.

---

## Benchmark Patterns

### Error recovery (Heroku)

```
$ heroku pss
>  Warning: pss is not a heroku command.
Did you mean ps? [y/n]:
```

Suggest corrections for typos; don't auto-run destructive commands.

### Flag discoverability (Atlassian Forge)

Show the flag name in the prompt text so users learn the non-interactive path:

```
Enter a name for your project [--name]:
```

### Next-step chaining (Forge)

After `forge login`, suggest `forge create`. After `forge create`, suggest `forge deploy`. Build a workflow story across commands.

### Concise help (Heroku)

```
$ heroku apps --help
list your apps

USAGE
  $ heroku apps

OPTIONS
  -A, --all       include apps in all teams
  ...

EXAMPLES
  $ heroku apps
  ...
```

Bold section headers, examples with actual output, flags with short lowercase descriptions.

### Progress steps (Forge)

```
Creating app...
i Downloading template
i Registering app
i Creating environments
Created my app
```

Checkmarks for completion, `i` for informational steps, final summary at the end.

### State change report (`git push`)

```
$ git push
...
To github.com:replicate/replicate.git
 + 6c22c90...a2a5217 bfirsh/fix-delete -> bfirsh/fix-delete
```

When you change state, confirm exactly what happened so users can update their mental model.

### "Show me the state" (`git status`)

`git status` shows the current state *and* hints at the commands that change it (`use "git add" to update...`). Surface state and possible next moves together.
