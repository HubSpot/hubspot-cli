// @ts-nocheck
const chalk = require('chalk');

export function bold(stringValue) {
  return chalk.bold(stringValue);
}
export function yellow(stringValue) {
  return chalk.reset.yellow(stringValue);
}
export function green(stringValue) {
  return chalk.reset.green(stringValue);
}
export function red(stringValue) {
  return chalk.reset.red(stringValue);
}
export function cyan(stringValue) {
  return chalk.cyan(stringValue);
}
export function orange(stringValue) {
  return chalk.hex('#FC9900')(stringValue);
}

/**
 * These helper methods are used to modify text output within the CLI. They
 * should all take in a string value and output a modified string value.
 */
module.exports = {
  bold,
  yellow,
  green,
  red,
  cyan,
  orange,
};
