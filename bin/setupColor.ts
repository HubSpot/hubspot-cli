#!/usr/bin/env node

import { hasColorDisableSignal } from '../lib/ui/supportsColor.js';

// Runs before cli.js so it executes before chalk is imported. chalk reads
// FORCE_COLOR (but not NO_COLOR / COLOR) once at load and caches its color
// level, and lang/en.ts bakes chalk styling into strings at import time. So
// translating a no-color request into FORCE_COLOR=0 here, ahead of those
// imports, is what makes NO_COLOR / COLOR actually disable color everywhere.
if (hasColorDisableSignal()) {
  process.env.FORCE_COLOR = '0';
}
