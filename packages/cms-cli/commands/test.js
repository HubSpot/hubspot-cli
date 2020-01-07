const { version } = require('../package.json');
const { promptUser, SCOPES } = require('../lib/prompts');

function runTest(program) {
  program
    .version(version)
    .description(`just testing`)
    .action(async () => {
      const { scopes } = await promptUser(SCOPES);
      console.log('Scopes: ', scopes);
    });
}

module.exports = {
  runTest,
};
