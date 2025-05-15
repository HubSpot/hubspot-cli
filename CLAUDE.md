# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands
- Build: `yarn build`
- Lint: `yarn lint` (eslint + prettier check)
- Format code: `yarn prettier:write`
- Run all tests: `yarn test`
- Run specific test: `yarn test commands/__tests__/specific-file.test.ts`
- Check circular dependencies: `yarn circular-deps`
- Run CLI acceptance tests: `yarn test-cli`
- Debug CLI: `yarn hs-debug`

## Code Style Guidelines
- TypeScript with strict type checking
- Follow Unix philosophy: small, focused modules that do one thing well
- Always check similar files for patterns and conventions before modifying
- Use functional patterns, avoid classes where possible
- Always use descriptive variable names that clearly indicate purpose
- When writing logger statements, always put strings in the en.ts file
- All new log statements should use the uiLogger
- Tests in `__tests__` directories using Jest
- Single quotes, 2-space indentation, trailing commas
- 80 character line limit, except in special files like lyaml
- No console.log in production code
- Early returns preferred for readability
- ESM modules (Node.js 18+ support)
- Type definitions in separate `/types` directory
- Never commit or push to main branch without permission
- Skipping tests is never a valid solution to fixing them