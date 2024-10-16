const helpers = require('./interpolationHelpers');
const delimiters = {
  interpolation: {
    start: '{{',
    end: '}}',
  },
  helpers: {
    start: '#',
    end: '/',
  },
};

const isHelperIdentifier = identifier => {
  return (
    identifier.startsWith(delimiters.helpers.start) ||
    identifier.startsWith(delimiters.helpers.end)
  );
};

const generateReplaceFn = (matchedText, startIndex, replacementString) => {
  return currentStringValue =>
    `${currentStringValue.slice(0, startIndex)}${
      replacementString !== null && replacementString !== undefined
        ? replacementString
        : ''
    }${currentStringValue.slice(startIndex + matchedText.length)}`;
};

/**
 * Interpolate a string with data
 * @param {string} stringValue - The string to interpolate
 * @param {object} interpolationData - The data to interpolate with
 * @returns {string} - The interpolated string
 * @example
 * interpolation('Hello {{name}}', { name: 'World' })
 * // 'Hello World'
 */
const interpolation = (stringValue, interpolationData) => {
  const interpolationIdentifierRegEx = new RegExp(
    `${delimiters.interpolation.start}(.*?)${delimiters.interpolation.end}`,
    'g'
  );
  const replaceQueue = [];
  let match;

  // while & reduce necessary because RegExp.exec is stateful and only runs
  // from beginning to end of string
  while ((match = interpolationIdentifierRegEx.exec(stringValue)) != null) {
    const { 0: matchedText, 1: rawIdentifier, index } = match;
    const identifier = rawIdentifier.trim();

    if (identifier && !isHelperIdentifier(identifier)) {
      replaceQueue.unshift(
        generateReplaceFn(matchedText, index, interpolationData[identifier])
      );
    }
  }

  const compiledString = replaceQueue.reduce(
    (currentValue, replaceFn) => replaceFn(currentValue),
    stringValue
  );

  return compiledString;
};

/**
 * Compile a string using a specified helper function
 * @param {string} stringValue - The string to modify
 * @param {object} helperIdentifier - Helper name
 * @param {function} helperFn - Helper function to call on string
 * @returns {string} - The modified string
 * @example
 * compileHelper('White {{#yellow}}yellow{{/yellow}}', 'yellow', (string) => { chalk.reset.yellow(string) }))))
 * // 'White yellow' (with 'yellow' colored yellow)
 */
const compileHelper = (stringValue, helperIdentifier, helperFn) => {
  const helperIdentifierRegEx = new RegExp(
    `${delimiters.interpolation.start}(${delimiters.helpers.start}${helperIdentifier})${delimiters.interpolation.end}(.*?)${delimiters.interpolation.start}(${delimiters.helpers.end}${helperIdentifier})${delimiters.interpolation.end}`,
    'g'
  );
  const replaceQueue = [];
  let match;

  // while & reduce necessary because RegExp.exec is stateful and only runs
  // from beginning to end of string
  while ((match = helperIdentifierRegEx.exec(stringValue)) != null) {
    const {
      0: matchedText,
      1: rawHelperIdentifierStart,
      2: innerText,
      index,
    } = match;
    const identifier = rawHelperIdentifierStart
      .replace(delimiters.helpers.start, '')
      .trim();

    if (identifier && helperFn) {
      replaceQueue.unshift(
        generateReplaceFn(matchedText, index, helperFn(innerText))
      );
    }
  }

  const compiledString = replaceQueue.reduce(
    (currentValue, replaceFn) => replaceFn(currentValue),
    stringValue
  );

  return compiledString;
};

const compileHelpers = stringValue => {
  return Object.keys(helpers).reduce((currentStringValue, helperIdentifier) => {
    return compileHelper(
      currentStringValue,
      helperIdentifier,
      helpers[helperIdentifier]
    );
  }, stringValue);
};

/**
 * Interpolate a string with data and compile helpers on the string
 * @param {string} stringValue - The string to interpolate
 * @param {object} interpolationData - The data to interpolate with
 * @returns {string} - The interpolated and helper-compiled string
 * @example
 * interpolateAndCompile('Some {{#bold}}{{text}}{{/bold}} text', { text: 'awesomely bold' })
 * // 'Some awsomely bold text' (with the words 'awesomely bold' in bold)
 */
const interpolate = (stringValue, interpolationData) => {
  const interpolatedString = interpolation(stringValue, interpolationData);
  const helperCompiledString = compileHelpers(interpolatedString);
  return helperCompiledString;
};

module.exports = {
  interpolate,
};
