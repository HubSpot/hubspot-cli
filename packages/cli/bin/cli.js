#!/usr/bin/env node

const yargs = require('yargs');
const updateNotifier = require('update-notifier');
const chalk = require('chalk');

const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { setLogLevel, getCommandName } = require('../lib/commonOpts');
const { trackHelpUsage } = require('../lib/usageTracking');
const { getIsInProject } = require('../lib/projects');
const pkg = require('../package.json');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

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
const projectCommands = require('../commands/project');
const themeCommand = require('../commands/theme');
const configCommand = require('../commands/config');
const accountsCommand = require('../commands/accounts');
const sandboxesCommand = require('../commands/sandbox');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

const notifier = updateNotifier({ pkg: { ...pkg, name: '@hubspot/cli' } });

const i18nKey = 'cli.commands.generalErrors';

const CLI_UPGRADE_MESSAGE =
  chalk.bold('The CMS CLI is now the HubSpot CLI') +
  '\n\nTo upgrade, run:\n\nnpm uninstall -g @hubspot/cms-cli\nand npm install -g @hubspot/cli';

notifier.notify({
  shouldNotifyInNpmScript: true,
  message: pkg.name === '@hubspot/cms-cli' ? CLI_UPGRADE_MESSAGE : null,
});

const getTerminalWidth = () => {
  const width = yargs.terminalWidth();

  if (width >= 100) return width * 0.9;

  return width;
};

const argv = yargs
  .usage('Tools for working with HubSpot')
  .middleware([setLogLevel])
  .exitProcess(false)
  .fail((msg, err, yargs) => {
    if (msg) {
      logger.error(msg);
    } else if (err) {
      logErrorInstance(err);
    }

    if (msg === null) {
      yargs.showHelp();
      process.exit(EXIT_CODES.SUCCESS);
    } else {
      process.exit(EXIT_CODES.ERROR);
    }
  })
  .option('debug', {
    alias: 'd',
    default: false,
    describe: 'set log level to debug',
    type: 'boolean',
  })
  .check(argv => {
    if (argv._.length === 1 && ['upload', 'watch'].includes(argv._[0])) {
      if (getIsInProject(argv.src)) {
        logger.error(
          i18n(`${i18nKey}.srcIsProject`, {
            src: argv.src,
            command: argv._.join(' '),
          })
        );
        process.exit(EXIT_CODES.ERROR);
      } else {
        return true;
      }
    } else {
      return true;
    }
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
  .command(projectCommands)
  .command(themeCommand)
  .command(configCommand)
  .command(accountsCommand)
  .command(sandboxesCommand)
  .help()
  .recommendCommands()
  .demandCommand(1, '')
  .completion()
  .wrap(getTerminalWidth())
  .strict().argv;

if (argv.help) {
  trackHelpUsage(getCommandName(argv));
}
