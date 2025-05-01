---
description: Testing Guidelines
globs: "**/__tests__/**/*.{js,ts}"
alwaysApply: false
---

# Testing Guidelines

When working with test files:

- Tests should be in `__tests__` directories
- Use Jest for testing
- Follow the naming convention of `[file-being-tested].test.ts`
- Run tests with `yarn test` or `yarn test [specific-file-path]`
- Run acceptance tests with `yarn test-cli`
- Debug tests with `yarn hs-debug`