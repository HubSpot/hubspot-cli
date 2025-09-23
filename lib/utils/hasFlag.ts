import process from 'process';

// See https://github.com/sindresorhus/has-flag/blob/main/index.js (License: https://github.com/sindresorhus/has-flag/blob/main/license)
export function hasFlag(flag: string, argv = process.argv): boolean {
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf('--');
  return (
    position !== -1 &&
    (terminatorPosition === -1 || position < terminatorPosition)
  );
}
