const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { logger } = require('@hubspot/cli-lib/logger');
const { interpolate } = require('./interpolation');

const MISSING_LANGUAGE_DATA_PREFIX = '[Missing language data]';

let locale;
let languageObj;

const loadLanguageFromYaml = () => {
  if (languageObj) return;

  try {
    const nodeLocale = Intl.DateTimeFormat()
      .resolvedOptions()
      .locale.split('-')[0];
    const languageFilePath = path.join(
      __dirname,
      `../lang/${nodeLocale}.lyaml`
    );
    const languageFileExists = fs.existsSync(languageFilePath);

    // Fall back to using the default language file
    locale = languageFileExists ? nodeLocale : 'en';
    languageObj = yaml.load(
      fs.readFileSync(path.join(__dirname, `../lang/${locale}.lyaml`), 'utf8')
    );

    logger.debug(
      'Loaded language data: ',
      util.inspect(languageObj, true, 999, true)
    );
  } catch (e) {
    logger.error('Error loading language data: ', e);
  }
};

const getTextValue = lookupDotNotation => {
  const lookupProps = [locale, ...lookupDotNotation.split('.')];
  const missingTextData = `${MISSING_LANGUAGE_DATA_PREFIX}: ${lookupProps.join(
    '.'
  )}`;
  let textValue = languageObj;
  let previouslyCheckedProp = lookupProps[0];

  try {
    lookupProps.forEach(prop => {
      textValue = textValue[prop];
      previouslyCheckedProp = prop;
    });
  } catch (e) {
    logger.error(
      `Unable to access language property: ${lookupProps.join(
        '.'
      )}. Failed to access prop "${previouslyCheckedProp}".`
    );
    return missingTextData;
  }

  if (!textValue) {
    return missingTextData;
  }

  return textValue;
};

const i18n = (lookupDotNotation, options = {}) => {
  if (!languageObj) {
    loadLanguageFromYaml();
  }

  if (typeof lookupDotNotation !== 'string') {
    throw new Error(
      `i18n must be passed a string value for lookupDotNotation, received ${typeof lookupDotNotation}`
    );
  }

  const textValue = getTextValue(lookupDotNotation);
  const shouldInterpolate = !textValue.startsWith(MISSING_LANGUAGE_DATA_PREFIX);

  return shouldInterpolate ? interpolate(textValue, options) : textValue;
};

const setLangData = (newLocale, newLangObj) => {
  locale = newLocale;
  languageObj = newLangObj;
};

module.exports = {
  i18n,
  setLangData,
};
