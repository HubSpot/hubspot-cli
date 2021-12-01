const chalk = require('chalk');

module.exports = {
  bold: function(stringValue) {
    return chalk.bold(stringValue);
  },
  yellow: function(stringValue) {
    return chalk.reset.yellow(stringValue);
  },
};
