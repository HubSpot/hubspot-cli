import chalk from 'chalk';

/**
 * These helper methods are used to modify text output within the CLI. They
 * should all take in a string value and output a modified string value.
 */

export function bold(stringValue: string): string {
  return chalk.bold(stringValue);
}

export function yellow(stringValue: string): string {
  return chalk.reset.yellow(stringValue);
}

export function green(stringValue: string): string {
  return chalk.reset.green(stringValue);
}

export function red(stringValue: string): string {
  return chalk.reset.red(stringValue);
}

export function cyan(stringValue: string): string {
  return chalk.cyan(stringValue);
}
export function orange(stringValue: string): string {
  return chalk.hex('#FC9900')(stringValue);
}
