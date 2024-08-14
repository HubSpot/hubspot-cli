const {
  isSpecifiedError,
  isMissingScopeError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { PLATFORM_VERSION_ERROR_TYPES } = require('../constants');
const { i18n } = require('../lang');
const {
  uiAccountDescription,
  uiLine,
  uiLink,
  uiCommandReference,
} = require('../ui');

const i18nKey = 'lib.errorHandlers.overrideErrors';

function createPlatformVersionError(err, subCategory) {
  let translationKey = 'unspecifiedPlatformVersion';
  let platformVersion = '';
  const errorContext =
    err.response && err.response.data && err.response.data.context;

  switch (subCategory) {
    case [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED]:
      platformVersion = 'unspecified platformVersion';
      break;
    case [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED]:
      translationKey = 'platformVersionRetired';
      if (errorContext && errorContext[subCategory]) {
        platformVersion = errorContext[subCategory];
      }
      break;
    case [
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST,
    ]:
      translationKey = 'nonExistentPlatformVersion';
      if (errorContext && errorContext[subCategory]) {
        platformVersion = errorContext[subCategory];
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

function overrideErrors(err, context) {
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

module.exports = {
  overrideErrors,
};
