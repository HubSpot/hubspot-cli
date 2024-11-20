const {
  isSpecifiedError,
  isMissingScopeError,
  ApiErrorContext,
} = require('@hubspot/local-dev-lib/errors/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { PLATFORM_VERSION_ERROR_TYPES } = require('../constants');
const { i18n } = require('../lang');
const {
  uiAccountDescription,
  uiLine,
  uiLink,
  uiCommandReference,
} = require('../ui');

const i18nKey = 'lib.errorHandlers.suppressErrors';

function createPlatformVersionError(err: unknown, subCategory: string): void {
  let translationKey = 'unspecifiedPlatformVersion';
  let platformVersion = 'unspecified platformVersion';
  const errorContext =
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof err.response === 'object' &&
    err.response !== null &&
    'data' in err.response &&
    typeof err.response.data === 'object' &&
    err.response.data !== null &&
    'context' in err.response.data
      ? err.response.data.context
      : undefined;

  switch (subCategory) {
    case PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED:
      translationKey = 'platformVersionRetired';
      if (
        errorContext &&
        (errorContext as { [key: string]: string })[subCategory]
      ) {
        platformVersion = (errorContext as { [key: string]: string })[
          subCategory
        ];
      }
      break;
    case PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST:
      translationKey = 'nonExistentPlatformVersion';
      if (
        errorContext &&
        (errorContext as { [key: string]: string })[subCategory]
      ) {
        platformVersion = (errorContext as { [key: string]: string })[
          subCategory
        ];
      }
      break;
    default:
      break;
  }

  uiLine();
  logger.error(i18n(`${i18nKey}.platformVersionErrors.header`));
  logger.log(
    i18n(`${i18nKey}.platformVersionErrors.${translationKey}`, {
      platformVersion,
    })
  );
  logger.log(i18n(`${i18nKey}.platformVersionErrors.updateProject`));
  logger.log(
    i18n(`${i18nKey}.platformVersionErrors.betaLink`, {
      docsLink: uiLink(
        i18n(`${i18nKey}.platformVersionErrors.docsLink`),
        'https://developers.hubspot.com/docs/platform/platform-versioning'
      ),
    })
  );
  uiLine();
}

export function shouldSuppressError(
  err: unknown,
  context?: typeof ApiErrorContext
): boolean {
  if (isMissingScopeError(err)) {
    logger.error(
      i18n(`${i18nKey}.missingScopeError`, {
        accountName: context.accountId
          ? uiAccountDescription(context.accountId)
          : '',
        request: context.request || 'request',
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
    if (typeof err === 'object' && err !== null && 'data' in err) {
      createPlatformVersionError(
        (err as { data: unknown }).data,
        PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED
      );
    }
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory: PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED,
    })
  ) {
    if (typeof err === 'object' && err !== null && 'data' in err) {
      createPlatformVersionError(
        (err as { data: unknown }).data,
        PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED
      );
    }
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory:
        PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST,
    })
  ) {
    if (typeof err === 'object' && err !== null && 'data' in err) {
      createPlatformVersionError(
        (err as { data: unknown }).data,
        PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST
      );
    }
    return true;
  }
  return false;
}
