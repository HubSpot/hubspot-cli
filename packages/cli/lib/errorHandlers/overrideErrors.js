const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/apiErrors');
const { logger } = require('@hubspot/local-dev-lib/logger');

const { PLATFORM_VERSION_ERROR_TYPES } = require('../constants');
const { i18n } = require('../lang');
const { uiLine, uiLink } = require('../ui');

const i18nKey = 'lib.errorHandlers.overrideErrors';

function createPlatformVersionError(subCategory, errData) {
  const docsLink = uiLink(
    i18n(`${i18nKey}.platformVersionErrors.docsLink`),
    'https://developers.hubspot.com/docs/platform/platform-versioning'
  );

  const platformVersionKey = {
    [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED]:
      'unspecified platformVersion',
    [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED]:
      errData.context.RETIRED_PLATFORM_VERSION,
    [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST]:
      errData.context.PLATFORM_VERSION,
  };

  const errorTypeToTranslationKey = {
    [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED]:
      'unspecifiedPlatformVersion',
    [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED]:
      'platformVersionRetired',
    [PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST]:
      'nonExistentPlatformVersion',
  };

  const platformVersion = platformVersionKey[subCategory] || '';
  const translationKey = errorTypeToTranslationKey[subCategory];

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
      docsLink,
    })
  );
  uiLine();
}

function overrideErrors(err) {
  if (
    isSpecifiedError(err, {
      subCategory: PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED,
    })
  ) {
    createPlatformVersionError(
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED,
      err.response.data
    );
    return true;
  }

  if (
    isSpecifiedError(err, {
      subCategory: PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED,
    })
  ) {
    createPlatformVersionError(
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED,
      err.response.data
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
      PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST,
      err.response.data
    );
    return true;
  }
  return false;
}

module.exports = {
  overrideErrors,
};
