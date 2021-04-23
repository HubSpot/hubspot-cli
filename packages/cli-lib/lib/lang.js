const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const handlebars = require('handlebars');
const yaml = require('js-yaml');

let languageObj;

const loadLanguageFromYaml = () => {
  if (languageObj) return;

  try {
    languageObj = yaml.load(
      fs.readFileSync(path.join(__dirname, '../lang/en.lyaml'), 'utf8')
    );
    console.log(
      'LOADED LANGUAGE: ',
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
    console.log('looking up prop: ', prop, textValue);
    textValue = textValue[prop];
  });

  console.log('textValue: ', textValue);

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
  const interpolatedValue = getInterpolatedValue(textValue, options.data);

  console.log('interpolatedValue: ', interpolatedValue);

  return interpolatedValue;
};

loadLanguageFromYaml();

module.exports = {
  i18n,
};
