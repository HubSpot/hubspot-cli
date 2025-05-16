#!/usr/bin/env node

const yargs = require('yargs');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../lib/errorHandlers/index');
const { setLogLevel, getCommandName } = require('../lib/commonOpts');
const {
  trackHelpUsage,
  trackConvertFieldsUsage,
} = require('../lib/usageTracking');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const {
  loadConfigMiddleware,
  injectAccountIdMiddleware,
  validateAccountOptions,
  handleDeprecatedEnvVariables,
} = require('../lib/middleware/configMiddleware');
const { autoUpdateCLI } = require('../lib/middleware/autoUpdateMiddleware');
const {
  checkAndWarnGitInclusionMiddleware,
} = require('../lib/middleware/gitMiddleware');
const { performChecks } = require('../lib/middleware/yargsChecksMiddleware');
const { setRequestHeaders } = require('../lib/middleware/requestMiddleware');
const { checkFireAlarms } = require('../lib/middleware/fireAlarmMiddleware');

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
const secretCommands = require('../commands/secret');
const customObjectCommand = require('../commands/customObject');
const functionCommands = require('../commands/function');
const listCommand = require('../commands/list');
const openCommand = require('../commands/open');
const mvCommand = require('../commands/mv');
const projectCommands = require('../commands/project');
const themeCommand = require('../commands/theme');
const moduleCommand = require('../commands/module');
const configCommand = require('../commands/config');
const accountCommands = require('../commands/account');
const sandboxesCommand = require('../commands/sandbox');
const cmsCommand = require('../commands/cms');
const feedbackCommand = require('../commands/feedback');
const doctorCommand = require('../commands/doctor');
const completionCommand = require('../commands/completion');
const appCommand = require('../commands/app');

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
    yargs.showHelp('log');
    process.exit(EXIT_CODES.SUCCESS);
  } else {
    process.exit(EXIT_CODES.ERROR);
  }
};

const argv = yargs
  .usage('The command line interface to interact with HubSpot.')
  // loadConfigMiddleware loads the new hidden config for all commands
  .middleware([
    setLogLevel,
    setRequestHeaders,
    handleDeprecatedEnvVariables,
    loadConfigMiddleware,
    injectAccountIdMiddleware,
    autoUpdateCLI,
    checkAndWarnGitInclusionMiddleware,
    validateAccountOptions,
    checkFireAlarms,
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
  .command(lintCommand)
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
  .command(moduleCommand)
  .command(configCommand)
  .command(accountCommands)
  .command(sandboxesCommand)
  .command(feedbackCommand)
  .command(doctorCommand)
  .command(completionCommand)
  .command(appCommand)
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
