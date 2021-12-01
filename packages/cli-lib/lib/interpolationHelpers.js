const chalk = require('chalk');

module.exports = {
  blue: function(stringValue) {
    return chalk.reset.blue(stringValue);
  },
  bold: function(stringValue) {
    return chalk.bold(stringValue);
  },
  yellow: function(stringValue) {
    return chalk.reset.yellow(stringValue);
  },
};
