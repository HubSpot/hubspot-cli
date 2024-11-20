const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  isHubSpotHttpError,
  isSystemError,
  isFileSystemError,
  isValidationError,
  isMissingScopeError,
} = require('@hubspot/local-dev-lib/errors/index');
import { FileSystemError } from '@hubspot/local-dev-lib/models/FileSystemError';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
import { BaseError } from '@hubspot/local-dev-lib/types/Error';
const { shouldSuppressError } = require('./suppressError');
const { i18n } = require('../lang');
const util = require('util');

const i18nKey = 'lib.errorHandlers.index';

export function logError(error: unknown, context?: typeof ApiErrorContext) {
  debugError(error, context);

  if (
    shouldSuppressError(error, context) ||
    shouldSuppressError(error, (error as HubSpotHttpError).context)
  ) {
    return;
  }

  if (isHubSpotHttpError(error) && context instanceof ApiErrorContext) {
    (error as HubSpotHttpError).updateContext(context);
  }

  if (isHubSpotHttpError(error) || isFileSystemError(error)) {
    if (isValidationError(error) || isMissingScopeError(error)) {
      logger.error((error as HubSpotHttpError).formattedValidationErrors());
    } else {
      logger.error((error as HubSpotHttpError | FileSystemError).message);
    }
  } else if (isSystemError(error)) {
    logger.error((error as BaseError).message);
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
    logger.error(i18n(`${i18nKey}.unknownErrorOccurred`));
  }
}

export function debugError(error: unknown, context?: typeof ApiErrorContext) {
  if (isHubSpotHttpError(error)) {
    logger.debug((error as HubSpotHttpError).toString());
  } else {
    logger.debug(i18n(`${i18nKey}.errorOccurred`, { error }));
  }

  if (isErrorWithCause(error)) {
    logger.debug(
      i18n(`${i18nKey}.errorCause`, {
        cause: util.inspect(error.cause, false, null, true),
      })
    );
  }
  if (context) {
    logger.debug(
      i18n(`${i18nKey}.errorContext`, {
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

function isErrorWithCause(error: unknown): error is { cause: unknown } {
  return typeof error === 'object' && error !== null && 'cause' in error;
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
