#!/usr/bin/env node

const SILENCED_ERRORS = ['DeprecationWarning:'];

const originalConsoleError = console.error;

console.error = msg => {
  const isSilencedError = SILENCED_ERRORS.some(
    error => typeof msg === 'string' && msg.includes(error)
  );
  if (isSilencedError) {
    return;
  }
  originalConsoleError(msg);
};
// test
