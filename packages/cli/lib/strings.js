const chalk = require('chalk');

const PROJECTS = {
  BUILD: {
    INITIALIZE: (name, numOfComponents) =>
      `Building ${chalk.bold(
        name
      )}\n\nFound ${numOfComponents} components in this project ...\n`,
    SUCCESS: name => `Built ${chalk.bold(name)}`,
  },
  DEPLOY: {
    INITIALIZE: (name, numOfComponents) =>
      `Deploying ${chalk.bold(
        name
      )}\n\nFound ${numOfComponents} components in this project ...\n`,
    SUCCESS: name => `Deployed ${chalk.bold(name)}`,
  },
};

module.exports = {
  PROJECTS,
};
