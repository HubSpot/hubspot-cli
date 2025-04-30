import {
  isSpecifiedError,
  isMissingScopeError,
} from '@hubspot/local-dev-lib/errors/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { PLATFORM_VERSION_ERROR_TYPES } from '../constants';
import { i18n } from '../lang';
import {
  uiAccountDescription,
  uiLine,
  uiLink,
  uiCommandReference,
} from '../ui';
import { ApiErrorContext } from './index';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';

function createPlatformVersionError(
  err: HubSpotHttpError,
  subCategory: string
): void {
  let translationKey = 'unspecifiedPlatformVersion';
  let platformVersion = 'unspecified platformVersion';
  const errorContext = err.data.context;

  switch (subCategory) {
    case PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED:
      translationKey = 'platformVersionRetired';
      if (errorContext && errorContext[subCategory]) {
        platformVersion = errorContext[subCategory];
      }
      break;
    case PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST:
      translationKey = 'nonExistentPlatformVersion';
      if (errorContext && errorContext[subCategory]) {
        platformVersion = errorContext[subCategory];
      }
      break;
    default:
      break;
  }

  uiLine();
  logger.error(
    i18n(`lib.errorHandlers.suppressErrors.platformVersionErrors.header`)
  );
  logger.log(
    i18n(
      `lib.errorHandlers.suppressErrors.platformVersionErrors.${translationKey}`,
      {
        platformVersion,
      }
    )
  );
  logger.log(
    i18n(`lib.errorHandlers.suppressErrors.platformVersionErrors.updateProject`)
  );
  logger.log(
    i18n(`lib.errorHandlers.suppressErrors.platformVersionErrors.betaLink`, {
      docsLink: uiLink(
        i18n(`lib.errorHandlers.suppressErrors.platformVersionErrors.docsLink`),
        'https://developers.hubspot.com/docs/platform/platform-versioning'
      ),
    })
  );
  uiLine();
}

export function shouldSuppressError(
  err: unknown,
  context?: ApiErrorContext
): boolean {
  if (isMissingScopeError(err)) {
    logger.error(
      i18n(`lib.errorHandlers.suppressErrors.missingScopeError`, {
        accountName: context?.accountId
          ? uiAccountDescription(context.accountId)
          : '',
        request: context?.request || 'request',
        authCommand: uiCommandReference('hs auth'),
      })
    );
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory: PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED,
    })
  ) {
    createPlatformVersionError(
      err.data,
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED
    );
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory: PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED,
    })
  ) {
    createPlatformVersionError(
      err.data,
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED
    );
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory:
        PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST,
    })
  ) {
    createPlatformVersionError(
      err.data,
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST
    );
    return true;
  }
  return false;
}
