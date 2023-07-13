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

    if (options.interval) {
      this.options.spinner.interval = options.interval;
    }

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

    // Custom fields
    this.parentSpinnerName = null;
    this.categories = {};
  }

  addSpinnerToCategory(name, category) {
    if (!this.categories[category]) {
      this.categories[category] = {};
    }
    this.categories[category][name] = true;
  }

  getSpinnerCategory(name) {
    return Object.keys(this.categories).find(
      category => !!this.categories[category][name]
    );
  }

  removeSpinnerFromCategory(name) {
    const category = this.getSpinnerCategory(name);
    if (category) {
      delete this.categories[category][name];
    }
  }

  pick(name) {
    return this.spinners[name];
  }

  add(name, options = {}) {
    const { category, isParent, noIndent, ...spinnerOptions } = options;

    // Support adding generic spinnies lines without specifying a name
    const resolvedName = name || `${Date.now()}-${Math.random()}`;

    if (category) {
      this.addSpinnerToCategory(resolvedName, category);
    }

    if (!options.text) {
      spinnerOptions.text = resolvedName;
    }

    const originalIndent = spinnerOptions.indent || 0;

    const spinnerProperties = {
      ...colorOptions(this.options),
      succeedPrefix: this.options.succeedPrefix,
      failPrefix: this.options.failPrefix,
      status: 'spinning',
      ...purgeSpinnerOptions(spinnerOptions),
      indent:
        this.parentSpinnerName && !noIndent
          ? originalIndent + 1
          : originalIndent,
    };

    this.spinners[resolvedName] = spinnerProperties;
    this.updateSpinnerState();

    if (isParent) {
      this.parentSpinnerName = resolvedName;
    }

    return { name: resolvedName, ...spinnerProperties };
  }

  update(name, options = {}) {
    const { status } = options;
    this.setSpinnerProperties(name, options, status);
    this.updateSpinnerState();

    return this.spinners[name];
  }

  // TODO there is an issue here with the usage of "non-spinnable"
  // The spinnies lib automatically removes any non-active spinners
  // after adding a new spinner (add -> updateSpinnerState -> checkIfActiveSpinners)
  // so "pick" is telling us that these newly-added spinners don't exist.
  addOrUpdate(name, options = {}) {
    const spinner = this.pick(name);

    if (spinner) {
      this.update(name, options);
    } else {
      this.add(name, options);
    }
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

    if (name === this.parentSpinnerName) {
      this.parentSpinnerName = null;
    }

    this.removeSpinnerFromCategory(name);

    const spinner = this.spinners[name];
    delete this.spinners[name];
    return spinner;
  }

  /**
   * Removes all spinnies instances
   * @param {string} targetCategory - remove all spinnies with a matching category
   * @param {string} preserveCategory - do not remove spinnies with a matching category
   */
  removeAll({ preserveCategory = null, targetCategory = null } = {}) {
    Object.keys(this.spinners).forEach(name => {
      if (targetCategory) {
        if (this.getSpinnerCategory(name) === targetCategory) {
          this.remove(name);
        }
      } else if (
        !preserveCategory ||
        this.getSpinnerCategory(name) !== preserveCategory
      ) {
        this.remove(name);
      }
    });
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
