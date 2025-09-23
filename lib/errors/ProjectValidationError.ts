export default class ProjectValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProjectValidationError';
  }
}

export function isProjectValidationError(
  err: unknown
): err is ProjectValidationError {
  return err instanceof ProjectValidationError;
}
