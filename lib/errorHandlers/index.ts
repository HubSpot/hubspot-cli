import { logger } from '@hubspot/local-dev-lib/logger';
import {
  isHubSpotHttpError,
  isValidationError,
} from '@hubspot/local-dev-lib/errors/index';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
import { shouldSuppressError } from './suppressError';
import { i18n } from '../lang';
import util from 'util';

const i18nKey = 'lib.errorHandlers.index';

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

  if (isHubSpotHttpError(error) && context instanceof ApiErrorContext) {
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
    logger.error(i18n(`${i18nKey}.unknownErrorOccurred`));
  }
}

export function debugError(error: unknown, context?: ApiErrorContext): void {
  if (isHubSpotHttpError(error)) {
    logger.debug((error as HubSpotHttpError).toString());
  } else {
    logger.debug(i18n(`${i18nKey}.errorOccurred`, { error: String(error) }));
  }

  if (error instanceof Error) {
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

function isErrorWithMessageOrReason(
  error: unknown
): error is { message?: string; reason?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || 'reason' in error)
  );
}
