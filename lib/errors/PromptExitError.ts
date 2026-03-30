export class PromptExitError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'PromptExitError';
    this.exitCode = exitCode;
  }
}
