const process = require('process');

// See https://github.com/sindresorhus/has-flag/blob/main/index.js (License: https://github.com/sindresorhus/has-flag/blob/main/license)

function hasFlag(flag, argv = process.argv) {
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf('--');
  return (
    position !== -1 &&
    (terminatorPosition === -1 || position < terminatorPosition)
  );
}

module.exports = hasFlag;
