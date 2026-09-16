import { ProjectConfigValidationError } from '@hubspot/project-parsing-lib/projects';

export default class ProjectValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProjectValidationError';
  }
}

export function isProjectValidationError(
  err: unknown
): err is ProjectValidationError | ProjectConfigValidationError {
  return (
    err instanceof ProjectValidationError ||
    err instanceof ProjectConfigValidationError
  );
}
