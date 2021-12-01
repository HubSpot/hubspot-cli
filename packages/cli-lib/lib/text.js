const chalk = require('chalk');

const commaSeparatedValues = (arr, conjunction = 'and', ifempty = '') => {
  let l = arr.length;
  if (!l) return ifempty;
  if (l < 2) return arr[0];
  if (l < 3) return arr.join(` ${conjunction} `);
  arr = arr.slice();
  arr[l - 1] = `${conjunction} ${arr[l - 1]}`;
  return arr.join(', ');
};

/**
 * These helper methods are used to modify text output within the CLI. They
 * should all take in a string value and output a modified string value.a
 */
const helpers = {
  bold: function(stringValue) {
    return chalk.bold(stringValue);
  },
  yellow: function(stringValue) {
    return chalk.reset.yellow(stringValue);
  },
};

module.exports = {
  commaSeparatedValues,
  helpers,
};
