const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const handlebars = require('handlebars');
const yaml = require('js-yaml');
const { logger } = require('../logger');

const MISSING_LANGUAGE_DATA_PREFIX = '[Missing language data]';

let languageObj;

const loadLanguageFromYaml = () => {
  if (languageObj) return;

  try {
    languageObj = yaml.load(
      fs.readFileSync(path.join(__dirname, '../lang/en.lyaml'), 'utf8')
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
  const lookupProps = lookupDotNotation.split('.');
  const missingTextData = `${MISSING_LANGUAGE_DATA_PREFIX}: ${lookupDotNotation}`;
  let textValue = languageObj;
  let previouslyCheckedProp = lookupProps[0];

  try {
    lookupProps.forEach(prop => {
      textValue = textValue[prop];
      previouslyCheckedProp = prop;
    });
  } catch (e) {
    logger.error(
      `Unable to access language property: ${lookupDotNotation}. Failed to access prop "${previouslyCheckedProp}".`
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
  const shouldInterpolate =
    options.data && !textValue.startsWith(MISSING_LANGUAGE_DATA_PREFIX);

  return shouldInterpolate
    ? getInterpolatedValue(textValue, options.data)
    : textValue;
};

loadLanguageFromYaml();

module.exports = {
  i18n,
};
