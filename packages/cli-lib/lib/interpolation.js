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

const interpolation = (stringValue, interpolationData) => {
  const interpolationIdentifierRegEx = new RegExp(
    `${delimiters.interpolation.start}(.*?)${delimiters.interpolation.end}`,
    'g'
  );
  const replaceQueue = [];
  let match;

  while ((match = interpolationIdentifierRegEx.exec(stringValue)) != null) {
    const { 0: matchedText, 1: rawIdentifier, index } = match;
    const identifier = rawIdentifier.trim();

    if (identifier && !isHelperIdentifier(identifier)) {
      replaceQueue.unshift(theString => {
        const newString = `${theString.slice(0, index)}${interpolationData[
          identifier
        ] || ''}${theString.slice(index + matchedText.length)}`;
        return newString;
      });
    }
  }

  const compiledString = replaceQueue.reduce(
    (currentValue, replaceFn) => replaceFn(currentValue),
    stringValue
  );

  return compiledString;
};

const compileHelper = (stringValue, helperIdentifier, helperFn) => {
  const helperIdentifierRegEx = new RegExp(
    `${delimiters.interpolation.start}(${delimiters.helpers.start}${helperIdentifier})${delimiters.interpolation.end}(.*?)${delimiters.interpolation.start}(${delimiters.helpers.end}${helperIdentifier})${delimiters.interpolation.end}`,
    'g'
  );
  const replaceQueue = [];
  let match;

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
    let replacementText = innerText;

    if (identifier && helperFn) {
      replaceQueue.unshift(theString => {
        const newString = `${theString.slice(0, index)}${helperFn(
          replacementText
        ) || ''}${theString.slice(index + matchedText.length)}`;
        return newString;
      });
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

const interpolate = (stringValue, interpolationData) => {
  const interpolatedString = interpolation(stringValue, interpolationData);
  const helperCompiledString = compileHelpers(interpolatedString);
  return helperCompiledString;
};

module.exports = {
  interpolate,
};
