const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { logger } = require('../logger');
// const { loadHandlebarsCustomHelpers } = require('./handlebarsCustomHelpers');

const MISSING_LANGUAGE_DATA_PREFIX = '[Missing language data]';
const DELIMITERS = {
  interpolate: {
    start: '{{',
    end: '}}',
  },
  helpers: {
    start: '#',
    end: '/',
  },
};

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

const isHelperIdentifier = identifier => {
  return (
    identifier.startsWith(DELIMITERS.helpers.start) ||
    identifier.startsWith(DELIMITERS.helpers.end)
  );
};

const interpolate = (stringValue, interpolationData) => {
  console.log('interpolationData: ', interpolationData);
  const interpolationIdentifierRegEx = new RegExp(
    `${DELIMITERS.interpolate.start}(.*?)${DELIMITERS.interpolate.end}`,
    'g'
  );
  const replaceQueue = [];
  let match;

  while ((match = interpolationIdentifierRegEx.exec(stringValue)) != null) {
    const { 0: matchedText, 1: rawIdentifier, index } = match;
    const identifier = rawIdentifier.trim();

    if (identifier && !isHelperIdentifier(identifier)) {
      console.log({
        identifier,
        matchedText,
        index,
        helper: isHelperIdentifier(identifier),
        replaceWith: interpolationData[identifier],
      });
      replaceQueue.unshift(theString => {
        console.log('theString: ', theString);
        const newString = `${theString.slice(0, index)}${interpolationData[
          identifier
        ] || ''}${theString.slice(index + matchedText.length)}`;
        console.log('newString: ', newString);
        return newString;
      });
    }
  }

  const compiledString = replaceQueue.reduce(
    (currentValue, replaceFn) => replaceFn(currentValue),
    stringValue
  );
  console.log('compiledString: ', compiledString);

  return compiledString;
};

const getInterpolatedValue = (textValue, interpolationData) => {
  const interpolatedString = interpolate(textValue, interpolationData);
  console.log('interpolatedString: ', interpolatedString);

  return interpolatedString;
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
