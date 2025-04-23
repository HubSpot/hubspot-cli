import { logger } from '@hubspot/local-dev-lib/logger';
import {
  isHubSpotHttpError,
  isValidationError,
} from '@hubspot/local-dev-lib/errors/index';
import { getConfig } from '@hubspot/local-dev-lib/config';

import { shouldSuppressError } from './suppressError';
import { i18n } from '../lang';
import util from 'util';
import { uiCommandReference } from '../ui';

export function logError(error: unknown, context?: ApiErrorContext): void {
  debugError(error, context);

  if (shouldSuppressError(error, context)) {
    return;
  }

  if (isHubSpotHttpError(error) && 'context' in error) {
    if (shouldSuppressError(error, error.context)) {
      return;
    }
  }

  if (isHubSpotHttpError(error) && context) {
    error.updateContext(context);
  }

  if (isHubSpotHttpError(error) && isValidationError(error)) {
    logger.error(error.formattedValidationErrors());
  } else if (isErrorWithMessageOrReason(error)) {
    const message: string[] = [];

    [error.message, error.reason].forEach(msg => {
      if (msg) {
        message.push(msg);
      }
    });
    logger.error(message.join(' '));
  } else {
    // Unknown errors
    logger.error(i18n(`lib.errorHandlers.index.unknownErrorOccurred`));
  }

  if (isHubSpotHttpError(error) && error.code === 'ETIMEDOUT') {
    const config = getConfig();
    const defaultTimeout = config?.httpTimeout;

    // Timeout was caused by the default timeout
    if (error.timeout && defaultTimeout === error.timeout) {
      logger.error(
        i18n(`lib.errorHandlers.index.configTimeoutErrorOccurred`, {
          timeout: error.timeout,
          configSetCommand: uiCommandReference('hs config set'),
        })
      );
    }
    // Timeout was caused by a custom timeout set by the CLI or LDL
    else {
      logger.error(i18n(`lib.errorHandlers.index.genericTimeoutErrorOccurred`));
    }
  }
}

export function debugError(error: unknown, context?: ApiErrorContext): void {
  if (isHubSpotHttpError(error)) {
    logger.debug(error.toString());
  } else {
    logger.debug(
      i18n(`lib.errorHandlers.index.errorOccurred`, { error: String(error) })
    );
  }

  if (error instanceof Error && error.cause && !isHubSpotHttpError(error)) {
    logger.debug(
      i18n(`lib.errorHandlers.index.errorCause`, {
        cause: util.inspect(error.cause, false, null, true),
      })
    );
  }
  if (context) {
    logger.debug(
      i18n(`lib.errorHandlers.index.errorContext`, {
        context: util.inspect(context, false, null, true),
      })
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

function isErrorWithMessageOrReason(
  error: unknown
): error is { message?: string; reason?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || 'reason' in error)
  );
}
