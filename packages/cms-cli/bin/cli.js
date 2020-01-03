const yargs = require('yargs');
const updateNotifier = require('update-notifier');

const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const {
  addLoggerOptions,
  getCommandName,
  setLogLevel,
} = require('../lib/commonOpts');
const { trackHelpUsage } = require('../lib/usageTracking');
const pkg = require('../package.json');

module.exports = scriptName => {
  const notifier = updateNotifier({ pkg });

  notifier.notify({
    shouldNotifyInNpmScript: true,
  });

  yargs
    .scriptName(scriptName)
    .usage('Tools for working with the HubSpot CMS')
    .middleware([setLogLevel])
    .exitProcess(false)
    .fail((msg, err /*, _yargs*/) => {
      if (msg) logger.error(msg);
      if (err) logErrorInstance(err);
      // console.log();
      // console.log(_yargs.help());
      // // process.exit(1);
    })
    .commandDir('../cmds')
    .demandCommand(
      1,
      `Please specifiy a command or run \`${scriptName} --help\` for a list of available commands`
    )
    .recommendCommands()
    .strict();

  addLoggerOptions(yargs, true);

  const { argv } = yargs;
  if (argv.help) {
    trackHelpUsage(getCommandName(argv));
  }

  return argv;
};
