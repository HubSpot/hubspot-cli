/*
https://github.com/jbcarpanelli/spinnies

Copyright 2019 Juan Bautista Carpanelli (jcarpanelli)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
**/
const readline = require('readline');
const stripAnsi = require('strip-ansi');

const VALID_STATUSES = [
  'succeed',
  'fail',
  'spinning',
  'non-spinnable',
  'stopped',
];
const VALID_COLORS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
];
const SPINNERS = {
  dots: {
    interval: 50,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
  dashes: {
    interval: 80,
    frames: ['-', '_'],
  },
};

function purgeSpinnerOptions(options) {
  const { text, status, indent } = options;
  const opts = { text, status, indent };
  const colors = colorOptions(options);

  if (!VALID_STATUSES.includes(status)) delete opts.status;
  if (typeof text !== 'string') delete opts.text;
  if (typeof indent !== 'number') delete opts.indent;

  return { ...colors, ...opts };
}

function purgeSpinnersOptions({ spinner, disableSpins, ...others }) {
  const colors = colorOptions(others);
  const prefixes = prefixOptions(others);
  const disableSpinsOption =
    typeof disableSpins === 'boolean' ? { disableSpins } : {};
  spinner = turnToValidSpinner(spinner);

  return { ...colors, ...prefixes, ...disableSpinsOption, spinner };
}

function turnToValidSpinner(spinner = {}) {
  const platformSpinner = terminalSupportsUnicode()
    ? SPINNERS.dots
    : SPINNERS.dashes;
  if (typeof spinner !== 'object') {
    return platformSpinner;
  }
  let { interval, frames } = spinner;
  if (!Array.isArray(frames) || frames.length < 1)
    frames = platformSpinner.frames;
  if (typeof interval !== 'number') {
    interval = platformSpinner.interval;
  }

  return { interval, frames };
}

function colorOptions({ color, succeedColor, failColor, spinnerColor }) {
  const colors = { color, succeedColor, failColor, spinnerColor };
  Object.keys(colors).forEach(key => {
    if (!VALID_COLORS.includes(colors[key])) {
      delete colors[key];
    }
  });

  return colors;
}

function prefixOptions({ succeedPrefix, failPrefix }) {
  if (terminalSupportsUnicode()) {
    succeedPrefix = succeedPrefix || '✓';
    failPrefix = failPrefix || '✖';
  } else {
    succeedPrefix = succeedPrefix || '√';
    failPrefix = failPrefix || '×';
  }

  return { succeedPrefix, failPrefix };
}

function breakText(text, prefixLength) {
  return text
    .split('\n')
    .map((line, index) =>
      index === 0 ? breakLine(line, prefixLength) : breakLine(line, 0)
    )
    .join('\n');
}

function breakLine(line, prefixLength) {
  const columns = process.stderr.columns || 95;
  return line.length >= columns - prefixLength
    ? `${line.substring(0, columns - prefixLength - 1)}\n${breakLine(
        line.substring(columns - prefixLength - 1, line.length),
        0
      )}`
    : line;
}

function getLinesLength(text, prefixLength) {
  return stripAnsi(text)
    .split('\n')
    .map((line, index) =>
      index === 0 ? line.length + prefixLength : line.length
    );
}

function writeStream(stream, output, rawLines) {
  stream.write(output);
  readline.moveCursor(stream, 0, -rawLines.length);
}

function cleanStream(stream, rawLines) {
  rawLines.forEach((lineLength, index) => {
    readline.moveCursor(stream, lineLength, index);
    readline.clearLine(stream, 1);
    readline.moveCursor(stream, -lineLength, -index);
  });
  readline.moveCursor(stream, 0, rawLines.length);
  readline.clearScreenDown(stream);
  readline.moveCursor(stream, 0, -rawLines.length);
}

function terminalSupportsUnicode() {
  // The default command prompt and powershell in Windows do not support Unicode characters.
  // However, the VSCode integrated terminal and the Windows Terminal both do.
  return (
    process.platform !== 'win32' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    !!process.env.WT_SESSION
  );
}

module.exports = {
  breakText,
  cleanStream,
  colorOptions,
  getLinesLength,
  purgeSpinnerOptions,
  purgeSpinnersOptions,
  SPINNERS,
  terminalSupportsUnicode,
  writeStream,
};
