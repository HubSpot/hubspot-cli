const chalk = require('chalk');

/**
 * These helper methods are used to modify text output within the CLI. They
 * should all take in a string value and output a modified string value.
 */
module.exports = {
  bold: function(stringValue) {
    return chalk.bold(stringValue);
  },
  yellow: function(stringValue) {
    return chalk.reset.yellow(stringValue);
  },
};
