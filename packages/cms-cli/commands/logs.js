const { version } = require('../package.json');
const { promptUser, FUNCTION_PATH } = require('../lib/prompts');
const { RESULTS } = require('@hubspot/cms-lib/lib/mocks');
const { /*toFile,*/ outputLogs } = require('@hubspot/cms-lib/lib/logs');

function getLogs(program) {
  program
    .version(version)
    .description(`get logs for a function`)
    .action(async () => {
      const { functionPath } = await promptUser(FUNCTION_PATH);
      console.log('Getting function with path: ', functionPath);
      outputLogs(RESULTS);
      // toFile(RESULTS);
    });
}

module.exports = {
  getLogs,
};
