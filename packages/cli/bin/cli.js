#!/usr/bin/env node

const yargs = require('yargs');
const updateNotifier = require('update-notifier');
const chalk = require('chalk');

const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('../lib/errorHandlers/standardErrors');
const { setLogLevel, getCommandName } = require('../lib/commonOpts');
const {
  trackHelpUsage,
  trackConvertFieldsUsage,
} = require('../lib/usageTracking');
const { getIsInProject } = require('../lib/projects');
const pkg = require('../package.json');
const { i18n } = require('../lib/lang');

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
const moduleCommand = require('../commands/module');
const configCommand = require('../commands/config');
const accountsCommand = require('../commands/accounts');
const sandboxesCommand = require('../commands/sandbox');
const cmsCommand = require('../commands/cms');
const feedbackCommand = require('../commands/feedback');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

const notifier = updateNotifier({
  pkg: { ...pkg, name: '@hubspot/cli' },
  distTag: 'latest',
  shouldNotifyInNpmScript: true,
});

const i18nKey = 'cli.commands.generalErrors';

const CLI_UPGRADE_MESSAGE =
  chalk.bold('The CMS CLI is now the HubSpot CLI') +
  '\n\nTo upgrade, run:\n\nnpm uninstall -g @hubspot/cms-cli\nand npm install -g @hubspot/cli';

notifier.notify({
  message: pkg.name === '@hubspot/cms-cli' ? CLI_UPGRADE_MESSAGE : null,
});

const getTerminalWidth = () => {
  const width = yargs.terminalWidth();

  if (width >= 100) return width * 0.9;

  return width;
};

const handleFailure = (msg, err, yargs) => {
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
};

const performChecks = argv => {
  // "hs config set default-account" has moved to "hs accounts use"
  if (
    argv._[0] === 'config' &&
    argv._[1] === 'set' &&
    argv._[2] === 'default-account'
  ) {
    logger.error(i18n(`${i18nKey}.setDefaultAccountMoved`));
    process.exit(EXIT_CODES.ERROR);
  }

  // Require "project" command when running upload/watch inside of a project
  if (argv._.length === 1 && ['upload', 'watch'].includes(argv._[0])) {
    if (getIsInProject(argv.src)) {
      logger.error(
        i18n(`${i18nKey}.srcIsProject`, {
          src: argv.src || './',
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
};

const argv = yargs
  .usage('The command line interface to interact with HubSpot.')
  .middleware([setLogLevel])
  .exitProcess(false)
  .fail(handleFailure)
  .option('debug', {
    alias: 'd',
    default: false,
    describe: 'Set log level to debug',
    type: 'boolean',
  })
  .option('noHyperlinks', {
    default: false,
    describe: 'prevent hyperlinks from displaying in the ui',
    hidden: true,
    type: 'boolean',
  })
  .option('noColor', {
    default: false,
    describe: 'prevent color from displaying in the ui',
    hidden: true,
    type: 'boolean',
  })
  .check(performChecks)
  .command(authCommand)
  .command(initCommand)
  .command(logsCommand)
  .command(cmsCommand)
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
  .command(moduleCommand)
  .command(configCommand)
  .command(accountsCommand)
  .command(sandboxesCommand)
  .command(feedbackCommand)
  .help()
  .recommendCommands()
  .demandCommand(1, '')
  .completion()
  .wrap(getTerminalWidth())
  .strict().argv;

if (argv.help) {
  trackHelpUsage(getCommandName(argv));
}

if (argv.convertFields) {
  trackConvertFieldsUsage(getCommandName(argv));
}
