#!/usr/bin/env node

const yargs = require('yargs');
const updateNotifier = require('update-notifier');
const chalk = require('chalk');

const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { setLogLevel, getCommandName } = require('../lib/commonOpts');
const { trackHelpUsage } = require('../lib/usageTracking');
const { version } = require('../package.json');

const removeCommand = require('../commands/remove');
const initCommand = require('../commands/init');
const logsCommand = require('../commands/logs');
const lintCommand = require('../commands/lint');
const hubdbCommand = require('../commands/hubdb');
const watchCommand = require('../commands/watch');
const authCommand = require('../commands/auth');
const uploadCommand = require('../commands/upload');
const createCommand = require('../commands/create');
const fetchCommand = require('../commands/fetch');
const filemanagerCommand = require('../commands/filemanager');
const secretsCommand = require('../commands/secrets');
const customObjectCommand = require('../commands/customObject');
const functionsCommand = require('../commands/functions');
const listCommand = require('../commands/list');
const openCommand = require('../commands/open');
const mvCommand = require('../commands/mv');

// Point update-notifier towards @hubspot/cli
const pkg = { name: '@hubspot/cli', version };

const notifier = updateNotifier({ pkg });

notifier.notify({
  shouldNotifyInNpmScript: true,
  message:
    chalk.bold('The CMS CLI is now the HubSpot CLI') +
    '\n\nTo upgrade, run:\n\nnpm uninstall -g @hubspot/cms-cli\nand npm install -g @hubspot/cli',
});

const argv = yargs
  .usage('Tools for working with the HubSpot CMS')
  .middleware([setLogLevel])
  .exitProcess(false)
  .fail((msg, err, yargs) => {
    if (msg) logger.error(msg);
    if (err) logErrorInstance(err);

    if (msg === null) {
      yargs.showHelp();
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .option('debug', {
    alias: 'd',
    default: false,
    describe: 'set log level to debug',
    type: 'boolean',
  })
  .command(authCommand)
  .command(initCommand)
  .command(logsCommand)
  .command(lintCommand)
  .command(hubdbCommand)
  .command(watchCommand)
  .command(removeCommand)
  .command(uploadCommand)
  .command(createCommand)
  .command(fetchCommand)
  .command(filemanagerCommand)
  .command(secretsCommand)
  .command(customObjectCommand)
  .command(functionsCommand)
  .command({
    ...listCommand,
    aliases: 'ls',
  })
  .command(openCommand)
  .command(mvCommand)
  .help()
  .recommendCommands()
  .demandCommand(1, '')
  .completion()
  .strict().argv;

if (argv.help) {
  trackHelpUsage(getCommandName(argv));
}
