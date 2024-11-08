/*
https://github.com/jbcarpanelli/spinnies

Copyright 2019 Juan Bautista Carpanelli (jcarpanelli)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
**/
import readline from 'readline';
import stripAnsi from 'strip-ansi';

export const VALID_STATUSES: string[] = [
  'succeed',
  'fail',
  'spinning',
  'non-spinnable',
  'stopped',
] as const;
const VALID_COLORS: string[] = [
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
] as const;

export type Spinner = {
  interval: number;
  frames: string[];
};

export type SpinnerOptions = {
  text?: string;
  status?: typeof VALID_STATUSES[number];
  indent?: number;
  spinner?: Partial<Spinner>;
  disableSpins?: boolean;
  color?: typeof VALID_COLORS[number];
  spinnerColor?: typeof VALID_COLORS[number];
  succeedColor?: typeof VALID_COLORS[number];
  failColor?: typeof VALID_COLORS[number];
  succeedPrefix?: string;
  failPrefix?: string;
};

export const SPINNERS: { [key: string]: Spinner } = {
  dots: {
    interval: 50,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
  dashes: {
    interval: 80,
    frames: ['-', '_'],
  },
};

export function purgeSpinnerOptions(options: SpinnerOptions): SpinnerOptions {
  const { text, status, indent } = options;
  const opts = { text, status, indent };
  const colors = colorOptions(options);

  if (!VALID_STATUSES.includes(status!)) delete opts.status;
  if (typeof text !== 'string') delete opts.text;
  if (typeof indent !== 'number') delete opts.indent;

  return { ...colors, ...opts };
}

export function purgeSpinnersOptions({
  spinner,
  disableSpins,
  ...others
}: SpinnerOptions): SpinnerOptions {
  const colors = colorOptions(others);
  const prefixes = prefixOptions(others);
  const disableSpinsOption =
    typeof disableSpins === 'boolean' ? { disableSpins } : {};
  spinner = turnToValidSpinner(spinner);

  return { ...colors, ...prefixes, ...disableSpinsOption, spinner };
}

function turnToValidSpinner(spinner: Partial<Spinner> = {}): Spinner {
  const platformSpinner = terminalSupportsUnicode()
    ? SPINNERS.dots
    : SPINNERS.dashes;
  if (typeof spinner !== 'object') {
    return platformSpinner;
  }
  let interval, frames;
  if ('interval' in spinner && 'frames' in spinner) {
    interval = spinner.interval;
    frames = spinner.frames;
  } else {
    interval = platformSpinner.interval;
    frames = platformSpinner.frames;
  }
  if (!Array.isArray(frames) || frames.length < 1)
    frames = platformSpinner.frames;
  if (typeof interval !== 'number') {
    interval = platformSpinner.interval;
  }

  return { interval, frames };
}

export function colorOptions({
  color,
  succeedColor,
  failColor,
  spinnerColor,
}: SpinnerOptions): Partial<SpinnerOptions> {
  const colors: Partial<SpinnerOptions> = {
    color,
    succeedColor,
    failColor,
    spinnerColor,
  };
  (Object.keys(colors) as Array<keyof SpinnerOptions>).forEach(key => {
    if (!VALID_COLORS.includes(colors[key] as typeof VALID_COLORS[number])) {
      delete colors[key as keyof SpinnerOptions];
    }
  });

  return colors;
}

export function prefixOptions({
  succeedPrefix,
  failPrefix,
}: SpinnerOptions): Partial<SpinnerOptions> {
  if (terminalSupportsUnicode()) {
    succeedPrefix = succeedPrefix || '✓';
    failPrefix = failPrefix || '✖';
  } else {
    succeedPrefix = succeedPrefix || '√';
    failPrefix = failPrefix || '×';
  }

  return { succeedPrefix, failPrefix };
}

export function breakText(text: string, prefixLength: number): string {
  return text
    .split('\n')
    .map((line, index) =>
      index === 0 ? breakLine(line, prefixLength) : breakLine(line, 0)
    )
    .join('\n');
}

function breakLine(line: string, prefixLength: number): string {
  const columns = process.stderr.columns || 95;
  return line.length >= columns - prefixLength
    ? `${line.substring(0, columns - prefixLength - 1)}\n${breakLine(
        line.substring(columns - prefixLength - 1, line.length),
        0
      )}`
    : line;
}

export function getLinesLength(text: string, prefixLength: number): number[] {
  return stripAnsi(text)
    .split('\n')
    .map((line, index) =>
      index === 0 ? line.length + prefixLength : line.length
    );
}

export function writeStream(
  stream: NodeJS.WriteStream,
  output: string,
  rawLines: number[]
): void {
  stream.write(output);
  readline.moveCursor(stream, 0, -rawLines.length);
}

export function cleanStream(
  stream: NodeJS.WriteStream,
  rawLines: number[]
): void {
  rawLines.forEach((lineLength, index) => {
    readline.moveCursor(stream, lineLength, index);
    readline.clearLine(stream, 1);
    readline.moveCursor(stream, -lineLength, -index);
  });
  readline.moveCursor(stream, 0, rawLines.length);
  readline.clearScreenDown(stream);
  readline.moveCursor(stream, 0, -rawLines.length);
}

export function terminalSupportsUnicode(): boolean {
  // The default command prompt and powershell in Windows do not support Unicode characters.
  // However, the VSCode integrated terminal and the Windows Terminal both do.
  return (
    process.platform !== 'win32' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    !!process.env.WT_SESSION
  );
}
