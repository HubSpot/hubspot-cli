---
description: Code Formatting Guidelines
globs: "**/*.{js,ts,jsx,tsx}"
alwaysApply: false
---

# Code Formatting Guidelines

Follow these formatting rules:

- Use single quotes for strings
- Use 2-space indentation
- Include trailing commas in arrays and objects
- Keep lines under 80 characters
  - Exception: lyaml files can exceed this limit
- Use `yarn prettier:write` to format code automatically
- Use `yarn lint` to check for formatting and linting issues