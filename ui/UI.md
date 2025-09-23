# Contributing to the Ink UI Folder

## Overview

All code in this folder wraps the [ink package](https://github.com/vadimdemedes/ink?tab=readme-ov-file).

## 1. Making New Components

Components should follow these guidelines:

- Components live in `/ui/components`
- Components must be added to the `ui-testing-utils` `populatedComponents` object with realistic prop data
  - This allows future devs and designers to see a full list of available components and their appearance
- You must define a 'getter' function along with the component definition
  - See other components for examples
  - This is required because most CLI files have `.ts` extensions and don't support JSX syntax
  - A getter allows us to pass around components without using JSX
- **Important:** Do not write JSX within ANY files not in `/ui`

## 2. Using Existing Components in the CLI

There are three main use cases for components:

### 2.1 Static Components

Used for adding new output or replacing legacy UI with an Ink component.

Requirements:
- Use the `renderInline` function along with a component's getter function
  - This renders the component once, then unmounts the Ink app
  - This approach gives an inline render appearance
  - Without this, the component will interfere with existing output flows (logs and prompts)
- These components should not have `useEffect` or lifecycle hooks
  - They will not work properly as they are statically rendered

### 2.2 Dynamic Components

Used when you need user input or need to display dynamic graphics (e.g., a spinner).

Requirements:
- Use Ink's `render` method
  - Returns an Ink `Instance` containing lifecycle management functions
  - Multiple `render` calls without unmounting previous renders will be overwritten
  - Previous output will no longer be visible in the terminal
- Must provide a valid callback for the component
  - Required for unmounting the component
  - Without this, the CLI will hang
- **Note:** These components have limited terminal resizing support
  - May allow expanding the terminal window
  - Shrinking the terminal window WILL create render artifacts

### 2.3 Screen Components

Used for interactive terminal experiences that take over the entire window (e.g., UiSandbox).

Requirements:
- Must use the `useTerminalSize` hook for terminal resizing support. You must set the height of the container using this hook to take advantage
of the re-render power of Ink.
- Reserve this use case for extremely interactive commands
  - Currently only used in `hs get-started`

## 3. The useTerminalSize Hook

This hook provides powerful functionality for accurate re-rendering on terminal size changes.

Important considerations:
- Can only be used with Screen components
- Will destroy any prior log output
- Should only be used in commands with:
  - No logs, OR
  - Logs that will be displayed within an Ink component present on the Screen
