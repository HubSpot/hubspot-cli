const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const handlebars = require('handlebars');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { logger } = require('../logger');

const MISSING_LANGUAGE_DATA_PREFIX = '[Missing language data]';

handlebars.registerHelper('bold', function(options) {
  return chalk.bold(options.fn(this));
});

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

const getInterpolatedValue = (textValue, interpolationData) => {
  const template = handlebars.compile(textValue);

  return template(interpolationData);
};

const i18n = (lookupDotNotation, options = {}) => {
  if (typeof lookupDotNotation !== 'string') {
    throw new Error(
      `i18n must be passed a string value for lookupDotNotation, received ${typeof lookupDotNotation}`
    );
  }

  const textValue = getTextValue(lookupDotNotation);
  const shouldInterpolate = !textValue.startsWith(MISSING_LANGUAGE_DATA_PREFIX);

  return shouldInterpolate
    ? getInterpolatedValue(textValue, options)
    : textValue;
};

loadLanguageFromYaml();

module.exports = {
  i18n,
};
