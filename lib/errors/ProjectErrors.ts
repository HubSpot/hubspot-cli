export class ProjectNestingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNestingError';
  }
}

export class ProjectConfigNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectConfigNotFoundError';
  }
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

export class ProjectUploadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ProjectUploadError';
  }
}

export class ProjectBuildDeployError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectBuildDeployError';
  }
}
