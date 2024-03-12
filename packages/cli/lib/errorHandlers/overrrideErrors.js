const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/apiErrors');
const { logger } = require('@hubspot/local-dev-lib/logger');

const { PLATFORM_VERSION_ERROR_TYPES } = require('../constants');
const { i18n } = require('../lang');
const { uiLink } = require('../ui');

const i18nKey = 'cli.lib.errorHandlers.overrideErrors';

function createDashes() {
  return '-'.repeat(79);
}

function createPlatformVersionError(subCategory, errorData) {
  const platformVersion = errorData.context.PLATFORM_VERSION[0];
  const docsLink = uiLink(
    i18n(`${i18nKey}.platformVersionErrors.docsLink`),
    'https://developers.hubspot.com/docs/platform/platform-versioning'
  );
  let translationKey;

  if (
    subCategory === PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED
  ) {
    translationKey = 'unspecifiedPlatformVersion';
  } else if (
    subCategory === PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED
  ) {
    translationKey = 'platformVersionRetired';
  } else if (
    subCategory ===
    PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST
  ) {
    translationKey = 'nonExistentPlatformVersion';
  }

  logger.log(createDashes());
  logger.log(i18n(`${i18nKey}.platformVersionErrors.header`));
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
  logger.log(createDashes());
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
