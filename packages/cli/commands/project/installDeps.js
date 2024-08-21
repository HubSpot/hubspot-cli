const { installDeps } = require('../../lib/dependencyManagement');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'install-deps';
exports.describe = 'Install your deps';
exports.builder = yargs => yargs;

exports.handler = async () => {
  try {
    await installDeps({});
  } catch (e) {
    logger.error(e.message());
    process.exit(EXIT_CODES.ERROR);
  }
};
