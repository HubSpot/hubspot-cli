import * as helpers from './interpolationHelpers';

interface interpolationDataType {
  [key: string]: string;
}

type HelperFunctions = typeof helpers;
type HelperIdentifier = keyof HelperFunctions;

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

function isHelperIdentifier(identifier: string): boolean {
  return (
    identifier.startsWith(delimiters.helpers.start) ||
    identifier.startsWith(delimiters.helpers.end)
  );
}

function generateReplaceFn(
  matchedText: string,
  startIndex: number,
  replacementString: string
): (arg0: string) => string {
  return currentStringValue =>
    `${currentStringValue.slice(0, startIndex)}${
      replacementString !== null && replacementString !== undefined
        ? replacementString
        : ''
    }${currentStringValue.slice(startIndex + matchedText.length)}`;
}

function interpolation(
  stringValue: string,
  interpolationData: interpolationDataType
): string {
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
}

function compileHelper(
  stringValue: string,
  helperIdentifier: string,
  helperFn: (arg0: string) => string
): string {
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
}

function compileHelpers(stringValue: string): string {
  return (Object.keys(helpers) as HelperIdentifier[]).reduce(
    (currentStringValue, helperIdentifier) => {
      return compileHelper(
        currentStringValue,
        helperIdentifier,
        helpers[helperIdentifier]
      );
    },
    stringValue
  );
}

export function interpolate(
  stringValue: string,
  interpolationData: interpolationDataType
): string {
  const interpolatedString = interpolation(stringValue, interpolationData);
  const helperCompiledString = compileHelpers(interpolatedString);
  return helperCompiledString;
}
