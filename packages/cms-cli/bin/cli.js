const yargs = require('yargs');
const updateNotifier = require('update-notifier');

const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const pkg = require('../package.json');

module.exports = scriptName => {
  const notifier = updateNotifier({ pkg });

  notifier.notify({
    shouldNotifyInNpmScript: true,
  });

  const argv = yargs
    .scriptName(scriptName)
    .usage('Tools for working with the HubSpot CMS')
    .commandDir('../cmds')
    .demandCommand(1, 'Please specifiy a command')
    .strict()
    .fail((msg, err, _yargs) => {
      if (msg) logger.error(msg);
      if (err) logErrorInstance(err);
      console.log();
      console.log(_yargs.help());
      process.exit(1);
    })
    .help().argv;

  // addLoggerOptions(program);
  // addHelpUsageTracking(program);

  return argv;
};
