import {
  isFileSystemError,
  isGithubRateLimitError,
  isGithubError,
  getHttpStatusFromError,
} from '@hubspot/local-dev-lib/errors/index';

const FAILURE_REASON = {
  GITHUB_RATE_LIMIT: 'github-rate-limit',
  GITHUB_NOT_FOUND: 'github-not-found',
  GITHUB_ERROR: 'github-error',
  HTTP_ERROR: 'http-error',
  FILESYSTEM: 'filesystem',
  UNKNOWN: 'unknown',
};

export function getProjectCreateFailureReason(error: unknown): string {
  if (isGithubRateLimitError(error)) {
    return FAILURE_REASON.GITHUB_RATE_LIMIT;
  }

  const httpStatus = getHttpStatusFromError(error);
  if (httpStatus !== undefined) {
    if (isGithubError(error)) {
      return httpStatus === 404
        ? FAILURE_REASON.GITHUB_NOT_FOUND
        : FAILURE_REASON.GITHUB_ERROR;
    }
    return FAILURE_REASON.HTTP_ERROR;
  }

  if (isFileSystemError(error)) {
    return FAILURE_REASON.FILESYSTEM;
  }

  return FAILURE_REASON.UNKNOWN;
}
