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
      console.log({
        identifier,
        matchedText,
        index,
        helper: isHelperIdentifier(identifier),
        replaceWith: interpolationData[identifier],
      });
      replaceQueue.unshift(theString => {
        // console.log('theString: ', theString);
        const newString = `${theString.slice(0, index)}${interpolationData[
          identifier
        ] || ''}${theString.slice(index + matchedText.length)}`;
        // console.log('newString: ', newString);
        return newString;
      });
    }
  }

  const compiledString = replaceQueue.reduce(
    (currentValue, replaceFn) => replaceFn(currentValue),
    stringValue
  );
  // console.log('compiledString: ', compiledString);

  return compiledString;
};

const compileHelpers = (stringValue /* interpolationData */) => {
  return stringValue;
};

const interpolate = (stringValue, interpolationData) => {
  console.log('BEFORE: ', stringValue, interpolationData);
  const interpolatedString = interpolation(stringValue, interpolationData);
  console.log('interpolatedString: ', interpolatedString);
  const helperCompiledString = compileHelpers(
    interpolatedString,
    interpolationData
  );
  console.log('helperCompiledString: ', helperCompiledString, helpers);
  return helperCompiledString;
};

module.exports = {
  interpolate,
};
