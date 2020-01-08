const { version } = require('../package.json');
const { promptUser, FUNCTION_PATH } = require('../lib/prompts');
const { toFile, outputLogs } = require('@hubspot/cms-lib/lib/logs');
const { logger } = require('@hubspot/cms-lib/logger');

// TODO - Remove mocked data
const { RESULTS } = require('@hubspot/cms-lib/lib/mocks');

function getLogs(program) {
  program
    .version(version)
    .description(`get logs for a function`)
    .option('-f, --file', 'output logs to file')
    .action(async options => {
      const { functionPath } = await promptUser(FUNCTION_PATH);
      logger.log(
        `Getting function logs for function with path: ${functionPath}`
      );

      if (options && options.file) {
        return toFile(RESULTS);
      }

      return outputLogs(RESULTS);
    });
}

module.exports = {
  getLogs,
};
