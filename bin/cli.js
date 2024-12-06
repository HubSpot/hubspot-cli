#!/usr/bin/env node

const yargs = require('yargs');
const updateNotifier = require('update-notifier');
const chalk = require('chalk');
const fs = require('fs');

const { logger } = require('@hubspot/local-dev-lib/logger');
const { addUserAgentHeader } = require('@hubspot/local-dev-lib/http');
const {
  loadConfig,
  configFileExists,
  getConfigPath,
} = require('@hubspot/local-dev-lib/config');
const { logError } = require('../lib/errorHandlers/index');
const {
  setLogLevel,
  getCommandName,
  injectAccountIdMiddleware,
} = require('../lib/commonOpts');
const {
  trackHelpUsage,
  trackConvertFieldsUsage,
} = require('../lib/usageTracking');
const { getIsInProject } = require('../lib/projects');
const pkg = require('../package.json');
const { i18n } = require('../lib/lang');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { UI_COLORS, uiCommandReference } = require('../lib/ui');

const removeCommand = require('../commands/remove');
const initCommand = require('../commands/init');
const logsCommand = require('../commands/logs');
const hubdbCommand = require('../commands/hubdb');
const watchCommand = require('../commands/watch');
const authCommand = require('../commands/auth');
const uploadCommand = require('../commands/upload');
const createCommand = require('../commands/create');
const fetchCommand = require('../commands/fetch');
const filemanagerCommand = require('../commands/filemanager');
const secretCommands = require('../commands/secret');
const customObjectCommand = require('../commands/customObject');
const functionCommands = require('../commands/function');
const listCommand = require('../commands/list');
const openCommand = require('../commands/open');
const mvCommand = require('../commands/mv');
const projectCommands = require('../commands/project');
const themeCommand = require('../commands/theme');
const configCommand = require('../commands/config');
const accountCommands = require('../commands/account');
const sandboxesCommand = require('../commands/sandbox');
const cmsCommand = require('../commands/cms');
const feedbackCommand = require('../commands/feedback');
const doctorCommand = require('../commands/doctor');
const completionCommand = require('../commands/completion');

const notifier = updateNotifier({
  pkg: { ...pkg, name: '@hubspot/cli' },
  distTag: 'latest',
  shouldNotifyInNpmScript: true,
});

const i18nKey = 'commands.generalErrors';

const CMS_CLI_PACKAGE_NAME = '@hubspot/cms-cli';

notifier.notify({
  message:
    pkg.name === CMS_CLI_PACKAGE_NAME
      ? i18n(`${i18nKey}.updateNotify.cmsUpdateNotification`, {
          packageName: CMS_CLI_PACKAGE_NAME,
          updateCommand: uiCommandReference('{updateCommand}'),
        })
      : i18n(`${i18nKey}.updateNotify.cliUpdateNotification`, {
          updateCommand: uiCommandReference('{updateCommand}'),
        }),
  defer: false,
  boxenOptions: {
    borderColor: UI_COLORS.MARIGOLD_DARK,
    margin: 1,
    padding: 1,
    textAlignment: 'center',
    borderStyle: 'round',
    title:
      pkg.name === CMS_CLI_PACKAGE_NAME
        ? null
        : chalk.bold(i18n(`${i18nKey}.updateNotify.notifyTitle`)),
  },
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
    logError(err);
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

const setRequestHeaders = () => {
  addUserAgentHeader('HubSpot CLI', pkg.version);
};

const loadConfigMiddleware = async options => {
  if (configFileExists(true)) {
    loadConfig('', options);

    if (options.config) {
      logger.error(
        i18n(`${i18nKey}.loadConfigMiddleware.configFileExists`, {
          configPath: getConfigPath(),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  // We need to load the config when options.config exists,
  // so that getAccountIdFromConfig() in injectAccountIdMiddleware reads from the right config
  if (options.config && fs.existsSync(options.config)) {
    const { config: configPath } = options;
    await loadConfig(configPath, options);
  }
};

const argv = yargs
  .usage('The command line interface to interact with HubSpot.')
  // loadConfigMiddleware loads the new hidden config for all commands
  .middleware([
    setLogLevel,
    setRequestHeaders,
    loadConfigMiddleware,
    injectAccountIdMiddleware,
  ])
  .exitProcess(false)
  .fail(handleFailure)
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
  .command(hubdbCommand)
  .command(watchCommand)
  .command(removeCommand)
  .command(uploadCommand)
  .command(createCommand)
  .command(fetchCommand)
  .command(filemanagerCommand)
  .command(secretCommands)
  .command(customObjectCommand)
  .command(functionCommands)
  .command({
    ...listCommand,
    aliases: 'ls',
  })
  .command(openCommand)
  .command(mvCommand)
  .command(projectCommands)
  .command(themeCommand)
  .command(configCommand)
  .command(accountCommands)
  .command(sandboxesCommand)
  .command(feedbackCommand)
  .command(doctorCommand)
  .command(completionCommand)
  .help()
  .alias('h', 'help')
  .recommendCommands()
  .demandCommand(1, '')
  .wrap(getTerminalWidth())
  .strict().argv;

if (argv.help) {
  trackHelpUsage(getCommandName(argv));
}

if (argv.convertFields) {
  trackConvertFieldsUsage(getCommandName(argv));
}
