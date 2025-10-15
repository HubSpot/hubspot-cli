import {
  isSpecifiedError,
  isMissingScopeError,
} from '@hubspot/local-dev-lib/errors/index';
import { uiLogger } from '../ui/logger.js';
import { PLATFORM_VERSION_ERROR_TYPES } from '../constants.js';
import { lib } from '../../lang/en.js';
import { uiAccountDescription, uiLine, uiLink } from '../ui/index.js';
import { ApiErrorContext } from './index.js';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';

function createPlatformVersionError(
  err: HubSpotHttpError,
  subCategory: string
): void {
  let translationKey = 'unspecifiedPlatformVersion';
  let platformVersion = 'unspecified platformVersion';
  const errorContext = err?.data?.context;

  if (subCategory === PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED) {
    platformVersion = errorContext?.RETIRED_PLATFORM_VERSION ?? platformVersion;
    translationKey = 'platformVersionRetired';
  } else if (
    subCategory ===
    PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST
  ) {
    platformVersion = errorContext?.PLATFORM_VERSION ?? platformVersion;
    translationKey = 'nonExistentPlatformVersion';
  }

  uiLine();
  uiLogger.error(lib.errorHandlers.suppressErrors.platformVersionErrors.header);
  const errorMessage =
    lib.errorHandlers.suppressErrors.platformVersionErrors[
      translationKey as keyof typeof lib.errorHandlers.suppressErrors.platformVersionErrors
    ];
  uiLogger.log(
    typeof errorMessage === 'function'
      ? errorMessage(platformVersion)
      : errorMessage
  );
  uiLogger.log(
    lib.errorHandlers.suppressErrors.platformVersionErrors.updateProject
  );
  uiLogger.log(
    lib.errorHandlers.suppressErrors.platformVersionErrors.betaLink(
      uiLink(
        lib.errorHandlers.suppressErrors.platformVersionErrors.docsLink,
        'https://developers.hubspot.com/docs/developer-tooling/platform/versioning'
      )
    )
  );
  uiLine();
}

export function shouldSuppressError(
  err: unknown,
  context?: ApiErrorContext
): boolean {
  if (isMissingScopeError(err)) {
    uiLogger.error(
      lib.errorHandlers.suppressErrors.missingScopeError(
        context?.request || 'request',
        context?.accountId ? uiAccountDescription(context.accountId) : ''
      )
    );
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory: PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED,
    })
  ) {
    createPlatformVersionError(
      err,
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
      err,
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
      err,
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST
    );
    return true;
  }
  return false;
}
