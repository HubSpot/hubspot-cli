import { uiLogger } from '../ui/logger.js';
import {
  isHubSpotHttpError,
  isValidationError,
} from '@hubspot/local-dev-lib/errors/index';
import { getConfig } from '@hubspot/local-dev-lib/config';

import { shouldSuppressError } from './suppressError.js';
import { lib } from '../../lang/en.js';
import util from 'util';
import { isProjectValidationError } from '../errors/ProjectValidationError.js';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';

export function logError(error: unknown, context?: ApiErrorContext): void {
  debugError(error, context);

  if (isProjectValidationError(error)) {
    uiLogger.error(error.message);
    return;
  }

  if (shouldSuppressError(error, context)) {
    return;
  }

  if (isHubSpotHttpError(error)) {
    if (shouldSuppressError(error, error.context)) {
      return;
    }

    error.updateContext(
      context || {},
      lib.errorHandlers.index.additionalDebugContext
    );
  }

  if (isHubSpotHttpError(error) && isValidationError(error)) {
    uiLogger.error(error.formattedValidationErrors());
  } else if (isErrorWithMessageOrReason(error)) {
    const message: string[] = [];

    [error.message, error.reason].forEach(msg => {
      if (msg) {
        message.push(msg);
      }
    });
    uiLogger.error(message.join(' '));
  } else {
    // Unknown errors
    uiLogger.error(lib.errorHandlers.index.unknownErrorOccurred);
  }

  let timeoutError: HubSpotHttpError | null = null;

  if (isHubSpotHttpError(error) && error.code === 'ETIMEDOUT') {
    timeoutError = error;
  } else if (
    error instanceof Error &&
    isHubSpotHttpError(error.cause) &&
    error.cause.code === 'ETIMEDOUT'
  ) {
    timeoutError = error.cause;
  }

  if (timeoutError) {
    const config = getConfig();
    const defaultTimeout = config?.httpTimeout;

    // Timeout was caused by the default timeout
    if (timeoutError.timeout && defaultTimeout === timeoutError.timeout) {
      uiLogger.error(
        lib.errorHandlers.index.configTimeoutErrorOccurred(
          timeoutError.timeout,
          'hs config set'
        )
      );
    }
    // Timeout was caused by a custom timeout set by the CLI or LDL
    else {
      uiLogger.error(lib.errorHandlers.index.genericTimeoutErrorOccurred);
    }
  }
}

export function debugError(error: unknown, context?: ApiErrorContext): void {
  if (isHubSpotHttpError(error)) {
    uiLogger.debug(error.toString());
  } else {
    uiLogger.debug(lib.errorHandlers.index.errorOccurred(String(error)));

    if (error instanceof Error && error.cause) {
      if (isHubSpotHttpError(error.cause)) {
        uiLogger.debug(error.cause.toString());
      } else {
        uiLogger.debug(
          lib.errorHandlers.index.errorCause(
            util.inspect(error.cause, false, null, true)
          )
        );
      }
    }
  }

  if (context) {
    uiLogger.debug(
      lib.errorHandlers.index.errorContext(
        util.inspect(context, false, null, true)
      )
    );
  }
}

export class ApiErrorContext {
  accountId?: number;
  request?: string;
  payload?: string;
  projectName?: string;

  constructor(
    props: {
      accountId?: number;
      request?: string;
      payload?: string;
      projectName?: string;
    } = {}
  ) {
    this.accountId = props.accountId;
    this.request = props.request || '';
    this.payload = props.payload || '';
    this.projectName = props.projectName || '';
  }
}

export function isErrorWithMessageOrReason(
  error: unknown
): error is { message?: string; reason?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || 'reason' in error)
  );
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`;
}
