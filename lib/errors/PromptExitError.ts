import { ExitCode } from '../../types/Yargs.js';

export class PromptExitError extends Error {
  exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode) {
    super(message);
    this.name = 'PromptExitError';
    this.exitCode = exitCode;
  }
}

export function isPromptExitError(e: unknown): e is PromptExitError {
  return e instanceof PromptExitError;
}
