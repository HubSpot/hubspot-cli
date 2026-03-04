#!/usr/bin/env node

import yargs, { Argv } from 'yargs';
import { logError } from '../lib/errorHandlers/index.js';
import { setCLILogLevel, getCommandName } from '../lib/commonOpts.js';
import {
  trackHelpUsage,
  trackConvertFieldsUsage,
} from '../lib/usageTracking.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import {
  validateConfigMiddleware,
  injectAccountIdMiddleware,
  validateAccountOptions,
  handleCustomConfigLocationMiddleware,
} from '../lib/middleware/configMiddleware.js';
import { autoUpdateCLI } from '../lib/middleware/autoUpdateMiddleware.js';
import { checkAndWarnGitInclusionMiddleware } from '../lib/middleware/gitMiddleware.js';
import { performChecks } from '../lib/middleware/yargsChecksMiddleware.js';
import { setRequestHeaders } from '../lib/middleware/requestMiddleware.js';
import { checkFireAlarms } from '../lib/middleware/fireAlarmMiddleware.js';
import { handleDisableUsageTracking } from '../lib/middleware/usageTrackingMiddleware.js';

import initCommand from '../commands/init.js';
import hubdbCommand from '../commands/hubdb.js';
import authCommand from '../commands/auth.js';
import filemanagerCommand from '../commands/filemanager.js';
import secretCommands from '../commands/secret.js';
import customObjectCommand from '../commands/customObject.js';
import openCommand from '../commands/open.js';
import projectCommands from '../commands/project.js';
import configCommand from '../commands/config.js';
import accountCommands from '../commands/account.js';
import sandboxesCommand from '../commands/sandbox.js';
import cmsCommand from '../commands/cms.js';
import feedbackCommand from '../commands/feedback.js';
import doctorCommand from '../commands/doctor.js';
import completionCommand from '../commands/completion.js';
import appCommand from '../commands/app.js';
import testAccountCommands from '../commands/testAccount.js';
import getStartedCommand from '../commands/getStarted.js';
import mcpCommand from '../commands/mcp.js';
import upgradeCommand from '../commands/upgrade.js';
import { uiLogger } from '../lib/ui/logger.js';
import { initializeSpinniesManager } from '../lib/middleware/spinniesMiddleware.js';
import { addCommandSuggestions } from '../lib/commandSuggestion.js';

function getTerminalWidth(): number {
  const width = yargs().terminalWidth();

  if (width >= 100) return width * 0.9;

  return width;
}

function handleFailure(msg: string, err: Error, yargs: Argv): void {
  if (msg) {
    uiLogger.error(msg);
  } else if (err) {
    logError(err);
  }

  if (msg === null && !err) {
    // Required so running `hs` without a command shows the help
    yargs.showHelp('log');
    process.exit(EXIT_CODES.SUCCESS);
  } else {
    process.exit(EXIT_CODES.ERROR);
  }
}

const argv = yargs(process.argv.slice(2))
  .usage('The command line interface to interact with HubSpot.')
  .middleware([
    setCLILogLevel,
    setRequestHeaders,
    handleCustomConfigLocationMiddleware,
    handleDisableUsageTracking,
    injectAccountIdMiddleware,
    validateConfigMiddleware,
    autoUpdateCLI,
    checkAndWarnGitInclusionMiddleware,
    validateAccountOptions,
    checkFireAlarms,
    initializeSpinniesManager,
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
  .option('disable-usage-tracking', {
    default: false,
    hidden: true,
    type: 'boolean',
  })
  .check(performChecks)
  // Getting started / important
  .command(getStartedCommand)
  .command(feedbackCommand)

  // Config/Account management
  .command(authCommand)
  .command(initCommand)
  .command(configCommand)
  .command(accountCommands)
  .command(testAccountCommands)
  .command(sandboxesCommand)
  .command(secretCommands)
  .command(openCommand)

  // Project commands
  .command(projectCommands)
  .command(appCommand)

  // CMS Commands
  .command(cmsCommand)
  .command(hubdbCommand)
  .command(filemanagerCommand)

  // Misc commands
  .command(customObjectCommand)
  .command(completionCommand)
  .command(doctorCommand)
  .command(mcpCommand)
  .command(upgradeCommand);

const argvWithSuggestions = addCommandSuggestions(argv)
  .help()
  .alias('h', 'help')
  .recommendCommands()
  .demandCommand(1, '')
  .wrap(getTerminalWidth())
  .strict().argv;

if ('help' in argvWithSuggestions && argvWithSuggestions.help !== undefined) {
  (async () => {
    await trackHelpUsage(getCommandName(argvWithSuggestions));
  })();
}

if (
  'convertFields' in argvWithSuggestions &&
  argvWithSuggestions.convertFields !== undefined
) {
  (async () => {
    await trackConvertFieldsUsage(getCommandName(argvWithSuggestions));
  })();
}
