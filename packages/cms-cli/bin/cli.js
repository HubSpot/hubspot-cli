#!/usr/bin/env node

const yargs = require('yargs');
const updateNotifier = require('update-notifier');

const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { setLogLevel, getCommandName } = require('../lib/commonOpts');
const { trackHelpUsage } = require('../lib/usageTracking');
const pkg = require('../package.json');

const removeCommand = require('../commands/remove');
const initCommand = require('../commands/init');
const authCommand = require('../commands/auth');

const SCRIPT_NAME = 'banjo';
const notifier = updateNotifier({ pkg });

notifier.notify({
  shouldNotifyInNpmScript: true,
});

const argv = yargs
  .scriptName(SCRIPT_NAME)
  .usage('Tools for working with the HubSpot CMS')
  .middleware([setLogLevel])
  .exitProcess(false)
  .fail((msg, err /*, _yargs*/) => {
    if (msg) logger.error(msg);
    if (err) logErrorInstance(err);
  })
  .command(removeCommand)
  .command(authCommand)
  .command(initCommand)
  .command(removeCommand)
  .help()
  .demandCommand(
    1,
    `Please specifiy a command or run \`${SCRIPT_NAME} --help\` for a list of available commands`
  )
  .recommendCommands()
  .strict().argv;

if (argv.help) {
  trackHelpUsage(getCommandName(argv));
}
