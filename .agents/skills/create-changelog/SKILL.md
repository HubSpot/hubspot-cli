---
name: cli:create-changelog
description: Generate a changelog for npm releases by analyzing git commits and categorizing changes
disable-model-invocation: true
allowed-tools: Bash(git:*), Read, Write
argument-hint: "[since-tag]"
---

# Create Changelog

Generate a clear, human-readable changelog for this CLI project to publish with new npm releases.

## Task

When this skill is invoked:

### 1. Find the latest full release tag

- Run `git fetch --tags` to ensure local tags are up to date with the remote
- Use `git tag --sort=-version:refname` to identify the latest tag matching format `vX.Y.Z` (e.g., v7.11.2)
- Ignore any tags containing '-beta' or other prerelease markers
- This is your comparison baseline
- If an argument is provided (e.g., `/create-changelog v7.10.0`), use that tag instead

### 2. Get the commit diff

- Compare the latest full release tag to HEAD on the current branch
- Use `git log <tag>..HEAD --format="%h|%s|%an|%ad" --date=short --no-merges` to get commit details
- Review commit messages to understand what changed

### 3. Analyze and categorize changes

Review each commit and categorize into groups (in order of severity):

1. **Breaking Changes**: Backward-incompatible changes, removals, or required manual migrations
2. **New Features**: New user-facing capabilities or commands
3. **Bug Fixes**: Fixes and what they address
4. **Improvements and Refactoring**: Performance optimizations, restructuring, or code quality updates

### 4. Determine release type

Apply semantic versioning rules (https://semver.org/):

- **Major**: Breaking changes to command inputs or behavior
- **Minor**: Net-new user-facing functionality that is backwards compatible
- **Patch**: Bug fixes or changes that don't impact command functionality

Provide clear reasoning for your recommendation.

### 5. Generate the changelog

Use the template below and fill all sections with concise bullet points. Write in clear, user-friendly language.

### 6. Write changelog to file

After generating the changelog:
- Extract the version number from the "Release X.Y.Z" heading
- Write the complete changelog content to a file named `CHANGELOG_<version>.md` in the repository root
- For example, if the release is 8.0.0, write to `CHANGELOG_8.0.0.md`
- Inform the user that the changelog has been written to the file
- On write conflict, overwrite the existing file

## Output Template

```markdown
# Release X.Y.Z [Major|Minor|Patch]

Full commit diff can be found [HERE](https://github.com/HubSpot/hubspot-cli/compare/vX.Y.Z...main)

## Reasoning

_Explain concisely (2–4 sentences) why this release is [major/minor/patch], referencing the change scope and user impact._

## To be announced

- _Key user-facing announcements (major changes, restructuring, or deprecations)._

## Notable changes

### Breaking Changes

- _Detail any backward-incompatible changes or mandatory migrations._

### New Features

- _Summarize new commands, options, or major user-facing features._

### Bug Fixes

- _Describe what was fixed and the improvement for users._

### Improvements and Refactoring

- _Detail performance, code quality, or internal changes visible to maintainers or advanced users._
```

## Important Constraints

- Do NOT include commit hashes, PR numbers, or internal implementation details in the changelog
- Focus on user-facing impact, not internal implementation details
- Keep descriptions clear and concise
- Omit sections that have no changes (e.g., if there are no breaking changes, remove that section)
- Group related changes together under clear headings
