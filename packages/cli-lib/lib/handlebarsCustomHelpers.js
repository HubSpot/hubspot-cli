const handlebars = require('handlebars');
const chalk = require('chalk');

const customHelpers = {
  bold: function(options) {
    return chalk.bold(options.fn(this));
  },
  yellow: function(options) {
    return chalk.reset.yellow(options.fn(this));
  },
};

const loadHandlebarsCustomHelpers = () => {
  Object.keys(customHelpers).forEach(key => {
    handlebars.registerHelper(key, customHelpers[key]);
  });
};

module.exports = {
  customHelpers,
  loadHandlebarsCustomHelpers,
};
