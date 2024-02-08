/*
https://github.com/jbcarpanelli/spinnies

Copyright 2019 Juan Bautista Carpanelli (jcarpanelli)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
**/

const readline = require('readline');
const chalk = require('chalk');
const cliCursor = require('cli-cursor');
const {
  breakText,
  cleanStream,
  colorOptions,
  getLinesLength,
  purgeSpinnerOptions,
  purgeSpinnersOptions,
  SPINNERS,
  terminalSupportsUnicode,
  writeStream,
} = require('./spinniesUtils');

class SpinniesManager {
  constructor() {
    this.resetState();
  }

  init(options = {}) {
    this.options = {
      spinnerColor: 'greenBright',
      succeedColor: 'green',
      failColor: 'red',
      spinner: terminalSupportsUnicode() ? SPINNERS.dots : SPINNERS.dashes,
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

  resetState() {
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

  pick(name) {
    return this.spinners[name];
  }

  add(name, options = {}) {
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

  update(name, options = {}) {
    const { status } = options;
    this.setSpinnerProperties(name, options, status);
    this.updateSpinnerState();

    return this.spinners[name];
  }

  succeed(name, options = {}) {
    this.setSpinnerProperties(name, options, 'succeed');
    this.updateSpinnerState();

    return this.spinners[name];
  }

  fail(name, options = {}) {
    this.setSpinnerProperties(name, options, 'fail');
    this.updateSpinnerState();

    return this.spinners[name];
  }

  remove(name) {
    if (typeof name !== 'string') {
      throw Error('A spinner reference name must be specified');
    }

    const spinner = this.spinners[name];
    delete this.spinners[name];
    return spinner;
  }

  stopAll(newStatus = 'stopped') {
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

  hasAnySpinners() {
    return !!Object.keys(this.spinners).length;
  }

  hasActiveSpinners() {
    return !!Object.values(this.spinners).find(
      ({ status }) => status === 'spinning'
    );
  }

  setSpinnerProperties(name, options, status) {
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

  updateSpinnerState() {
    if (this.spin) {
      clearInterval(this.currentInterval);
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

  loopStream() {
    const { frames, interval } = this.options.spinner;
    return setInterval(() => {
      this.setStreamOutput(frames[this.currentFrameIndex]);
      this.currentFrameIndex =
        this.currentFrameIndex === frames.length - 1
          ? 0
          : ++this.currentFrameIndex;
    }, interval);
  }

  setStreamOutput(frame = '') {
    let output = '';
    const linesLength = [];
    const hasActiveSpinners = this.hasActiveSpinners();
    Object.values(this.spinners).map(
      ({
        text,
        status,
        color,
        spinnerColor,
        succeedColor,
        failColor,
        succeedPrefix,
        failPrefix,
        indent,
      }) => {
        let line;
        let prefixLength = indent || 0;
        if (status === 'spinning') {
          prefixLength += frame.length + 1;
          text = breakText(text, prefixLength);
          line = `${chalk[spinnerColor](frame)} ${
            color ? chalk[color](text) : text
          }`;
        } else {
          if (status === 'succeed') {
            prefixLength += succeedPrefix.length + 1;
            if (hasActiveSpinners) {
              text = breakText(text, prefixLength);
            }
            line = `${chalk.green(succeedPrefix)} ${chalk[succeedColor](text)}`;
          } else if (status === 'fail') {
            prefixLength += failPrefix.length + 1;
            if (hasActiveSpinners) {
              text = breakText(text, prefixLength);
            }
            line = `${chalk.red(failPrefix)} ${chalk[failColor](text)}`;
          } else {
            if (hasActiveSpinners) {
              text = breakText(text, prefixLength);
            }
            line = color ? chalk[color](text) : text;
          }
        }
        linesLength.push(...getLinesLength(text, prefixLength));
        output += indent ? `${' '.repeat(indent)}${line}\n` : `${line}\n`;
      }
    );

    if (!hasActiveSpinners) {
      readline.clearScreenDown(this.stream);
    }

    writeStream(this.stream, output, linesLength);

    if (hasActiveSpinners) {
      cleanStream(this.stream, linesLength);
    }

    this.lineCount = linesLength.length;
  }

  setRawStreamOutput() {
    Object.values(this.spinners).forEach(i => {
      process.stderr.write(`- ${i.text}\n`);
    });
  }

  checkIfActiveSpinners() {
    if (!this.hasActiveSpinners()) {
      if (this.spin) {
        this.setStreamOutput();
        readline.moveCursor(this.stream, 0, this.lineCount);
        clearInterval(this.currentInterval);
        this.isCursorHidden = false;
        cliCursor.show();
      }
      this.spinners = {};
    }
  }

  bindSigint() {
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', () => {
      cliCursor.show();
      readline.moveCursor(process.stderr, 0, this.lineCount);
      process.exit(0);
    });
  }
}

module.exports = new SpinniesManager();
