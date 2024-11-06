/*
https://github.com/jbcarpanelli/spinnies

Copyright 2019 Juan Bautista Carpanelli (jcarpanelli)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
**/

import readline from 'readline';
import chalk from 'chalk';
import cliCursor from 'cli-cursor';
import {
  breakText,
  cleanStream,
  colorOptions,
  getLinesLength,
  purgeSpinnerOptions,
  purgeSpinnersOptions,
  Spinner,
  SPINNERS,
  terminalSupportsUnicode,
  writeStream,
  SpinnerOptions as BaseSpinnerOptions,
  VALID_STATUSES,
  prefixOptions,
} from './spinniesUtils';

interface SpinnerState extends BaseSpinnerOptions {
  name?: string;
}

function safeColor(text: string, color?: string): string {
  const chalkFn = chalk[color as keyof typeof chalk];

  if (typeof chalkFn === 'function') {
    return (chalkFn as (text: string) => string)(text);
  }
  return text;
}

class SpinniesManager {
  private options!: SpinnerState;
  private spinners: Record<string, SpinnerState> = {};
  private isCursorHidden: boolean = false;
  private currentInterval: NodeJS.Timeout | null = null;
  private stream: NodeJS.WriteStream = process.stderr;
  private lineCount: number = 0;
  private currentFrameIndex: number = 0;
  private spin: boolean = false;

  constructor() {
    this.resetState();
  }

  init(options: Partial<SpinnerState> = {}): void {
    this.options = {
      spinnerColor: 'greenBright',
      succeedColor: 'green',
      failColor: 'red',
      spinner: (terminalSupportsUnicode()
        ? SPINNERS.dots
        : SPINNERS.dashes) as Spinner,
      disableSpins: false,
      ...purgeSpinnersOptions(options),
    };
    this.spin =
      !this.options.disableSpins &&
      !process.env.CI &&
      process.stderr &&
      process.stderr.isTTY;

    if (!this.hasAnySpinners()) {
      this.resetState();
    }
    this.bindSigint();
  }

  private resetState() {
    // Default Spinnies fields
    this.spinners = {};
    this.isCursorHidden = false;
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
    }
    this.currentInterval = null;
    this.stream = process.stderr;
    this.lineCount = 0;
    this.currentFrameIndex = 0;
  }

  pick(name: string): SpinnerState | undefined {
    return this.spinners ? this.spinners[name] : undefined;
  }

  add(
    name: string,
    options: Partial<SpinnerState> = {}
  ): SpinnerState & { name: string } {
    // Support adding generic spinnies lines without specifying a name
    const resolvedName = name || `${Date.now()}-${Math.random()}`;

    if (!options.text) {
      options.text = resolvedName;
    }

    const spinnerProperties = {
      ...colorOptions(this.options),
      succeedPrefix: this.options.succeedPrefix,
      failPrefix: this.options.failPrefix,
      status: 'spinning',
      ...purgeSpinnerOptions(options),
    };

    this.spinners[resolvedName] = spinnerProperties;
    this.updateSpinnerState();

    return { name: resolvedName, ...spinnerProperties };
  }

  update(name: string, options: Partial<SpinnerState> = {}): SpinnerState {
    const { status = 'spinning' } = options;
    this.setSpinnerProperties(name, options, status);
    this.updateSpinnerState();

    return this.spinners[name];
  }

  succeed(name: string, options: Partial<SpinnerState> = {}): SpinnerState {
    this.setSpinnerProperties(name, options, 'succeed');
    this.updateSpinnerState();

    return this.spinners[name];
  }

  fail(name: string, options: Partial<SpinnerState> = {}): SpinnerState {
    this.setSpinnerProperties(name, options, 'fail');
    this.updateSpinnerState();

    return this.spinners[name];
  }

  remove(name: string): SpinnerState {
    if (typeof name !== 'string') {
      throw Error('A spinner reference name must be specified');
    }

    const spinner = this.spinners[name];
    delete this.spinners[name];
    return spinner;
  }

  stopAll(
    newStatus: typeof VALID_STATUSES[number] = 'stopped'
  ): Record<string, SpinnerState> {
    Object.keys(this.spinners).forEach(name => {
      const { status: currentStatus } = this.spinners[name];
      if (
        currentStatus !== 'fail' &&
        currentStatus !== 'succeed' &&
        currentStatus !== 'non-spinnable'
      ) {
        if (newStatus === 'succeed' || newStatus === 'fail') {
          this.spinners[name].status = newStatus;
          this.spinners[name].color = this.options[`${newStatus}Color`];
        } else {
          this.spinners[name].status = 'stopped';
          this.spinners[name].color = 'grey';
        }
      }
    });
    this.checkIfActiveSpinners();

    return this.spinners;
  }

  private hasAnySpinners(): boolean {
    return !!Object.keys(this.spinners).length;
  }

  hasActiveSpinners(): boolean {
    return !!Object.values(this.spinners).find(
      ({ status }) => status === 'spinning'
    );
  }

  private setSpinnerProperties(
    name: string,
    options: Partial<SpinnerState>,
    status: typeof VALID_STATUSES[number]
  ): void {
    if (typeof name !== 'string') {
      throw Error('A spinner reference name must be specified');
    }
    if (!this.spinners[name]) {
      throw Error(`No spinner initialized with name ${name}`);
    }
    options = purgeSpinnerOptions(options);
    status = status || 'spinning';

    this.spinners[name] = { ...this.spinners[name], ...options, status };
  }

  private updateSpinnerState(): void {
    if (this.spin) {
      clearInterval(this.currentInterval as NodeJS.Timeout);
      this.currentInterval = this.loopStream();
      if (!this.isCursorHidden) {
        cliCursor.hide();
      }
      this.isCursorHidden = true;
      this.checkIfActiveSpinners();
    } else {
      this.setRawStreamOutput();
    }
  }

  private loopStream(): NodeJS.Timeout {
    const frames = this.options.spinner?.frames || SPINNERS.dots.frames;
    const interval = this.options.spinner?.interval || SPINNERS.dots.interval;

    return setInterval(() => {
      this.setStreamOutput(frames[this.currentFrameIndex]);
      this.currentFrameIndex =
        this.currentFrameIndex === frames.length - 1
          ? 0
          : ++this.currentFrameIndex;
    }, interval);
  }

  private setStreamOutput(frame = ''): void {
    let output = '';
    const linesLength: number[] = [];
    const hasActiveSpinners = this.hasActiveSpinners();
    Object.values(this.spinners).forEach(spinner => {
      let { text } = spinner;
      const {
        status,
        color,
        spinnerColor,
        succeedColor,
        failColor,
        indent = 0,
        succeedPrefix = prefixOptions(this.options).succeedPrefix!,
        failPrefix = prefixOptions(this.options).failPrefix!,
      } = spinner;
      let line;
      let prefixLength = indent;
      text = text ?? '';

      if (status === 'spinning') {
        prefixLength += frame.length + 1;
        text = breakText(text, prefixLength);
        const colorizedFrame = safeColor(frame, spinnerColor);
        const colorizedText = safeColor(text, color);
        line = `${colorizedFrame} ${colorizedText}`;
      } else {
        if (status === 'succeed') {
          prefixLength += succeedPrefix.length + 1;
          if (hasActiveSpinners) {
            text = breakText(text, prefixLength);
          }
          const colorizedText = safeColor(text, succeedColor);
          line = `${chalk.green(succeedPrefix)} ${colorizedText}`;
        } else if (status === 'fail') {
          prefixLength += failPrefix.length + 1;
          if (hasActiveSpinners) {
            text = breakText(text, prefixLength);
          }
          const colorizedText = safeColor(text, failColor);
          line = `${chalk.red(failPrefix)} ${colorizedText}`;
        } else {
          if (hasActiveSpinners) {
            text = breakText(text, prefixLength);
          }
          line = safeColor(text, color);
        }
      }
      linesLength.push(...getLinesLength(text, prefixLength));
      output += indent ? `${' '.repeat(indent)}${line}\n` : `${line}\n`;
    });

    if (!hasActiveSpinners) {
      readline.clearScreenDown(this.stream);
    }

    writeStream(this.stream, output, linesLength);

    if (hasActiveSpinners) {
      cleanStream(this.stream, linesLength);
    }

    this.lineCount = linesLength.length;
  }

  private setRawStreamOutput(): void {
    Object.values(this.spinners).forEach(i => {
      process.stderr.write(`- ${i.text}\n`);
    });
  }

  private checkIfActiveSpinners(): void {
    if (!this.hasActiveSpinners()) {
      if (this.spin) {
        this.setStreamOutput();
        readline.moveCursor(this.stream, 0, this.lineCount);
        clearInterval(this.currentInterval as NodeJS.Timeout);
        this.isCursorHidden = false;
        cliCursor.show();
      }
      this.spinners = {};
    }
  }

  private bindSigint(): void {
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', () => {
      cliCursor.show();
      readline.moveCursor(process.stderr, 0, this.lineCount);
      process.exit(0);
    });
  }
}

const toExport = new SpinniesManager();
export default toExport;
module.exports = toExport;
