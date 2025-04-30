---
description: HubSpot CLI Code Style Guidelines
globs: "**/*.{js,ts,jsx,tsx}"
alwaysApply: true
---

# HubSpot CLI Code Style Guidelines

Follow these guidelines when working with code in this repository:

- Use TypeScript with strict type checking
- Follow Unix philosophy: small, focused modules that do one thing well
- Always check similar files for patterns and conventions before modifying
- Use functional patterns, avoid classes where possible
- Always use descriptive variable names that clearly indicate purpose
- When writing logger statements, always put strings in the en.ts file
- Write tests in `__tests__` directories using Jest
- Use single quotes, 2-space indentation, trailing commas
- Keep lines under 80 characters, except in special files like lyaml
- No console.log in production code
- Prefer early returns for readability
- Use ESM modules (Node.js 18+ support)
- Keep type definitions in separate `/types` directory