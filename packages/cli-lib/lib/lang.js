const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const handlebars = require('handlebars');
const yaml = require('js-yaml');
const { logger } = require('../logger');

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
    console.log(e);
  }
};

const getTextValue = lookupDotNotation => {
  const lookupProps = lookupDotNotation.split('.');
  let textValue = languageObj;

  lookupProps.forEach(prop => {
    textValue = textValue[prop];
  });

  return textValue;
};

const getInterpolatedValue = (textValue, options) => {
  const template = handlebars.compile(textValue);

  return template(options);
};

const i18n = (lookupDotNotation, options = {}) => {
  // TODO - Figure out how to get language and project accessors
  // console.log('process: ', process);
  const textValue = getTextValue(lookupDotNotation);
  return getInterpolatedValue(textValue, options.data);
};

loadLanguageFromYaml();

module.exports = {
  i18n,
};
