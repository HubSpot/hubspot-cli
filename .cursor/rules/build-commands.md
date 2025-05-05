---
description: HubSpot CLI Build/Lint/Test Commands
alwaysApply: true
---

# HubSpot CLI Build Commands

Use these commands when working with this codebase:

- Build: `yarn build`
- Lint: `yarn lint` (eslint + prettier check)
- Format code: `yarn prettier:write`
- Run all tests: `yarn test`
- Run specific test: `yarn test commands/__tests__/specific-file.test.ts`
- Check circular dependencies: `yarn circular-deps`
- Run CLI acceptance tests: `yarn test-cli`
- Debug CLI: `yarn hs-debug`

Always run linting and tests before committing changes.