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
  loadAndValidateConfigMiddleware,
  injectAccountIdMiddleware,
  validateAccountOptions,
  handleDeprecatedEnvVariables,
} from '../lib/middleware/configMiddleware.js';
import { autoUpdateCLI } from '../lib/middleware/autoUpdateMiddleware.js';
import { checkAndWarnGitInclusionMiddleware } from '../lib/middleware/gitMiddleware.js';
import { performChecks } from '../lib/middleware/yargsChecksMiddleware.js';
import { setRequestHeaders } from '../lib/middleware/requestMiddleware.js';
import { checkFireAlarms } from '../lib/middleware/fireAlarmMiddleware.js';

import removeCommand from '../commands/remove.js';
import initCommand from '../commands/init.js';
import logsCommand from '../commands/logs.js';
import lintCommand from '../commands/lint.js';
import hubdbCommand from '../commands/hubdb.js';
import watchCommand from '../commands/watch.js';
import authCommand from '../commands/auth.js';
import uploadCommand from '../commands/upload.js';
import createCommand from '../commands/create.js';
import fetchCommand from '../commands/fetch.js';
import filemanagerCommand from '../commands/filemanager.js';
import secretCommands from '../commands/secret.js';
import customObjectCommand from '../commands/customObject.js';
import functionCommands from '../commands/function.js';
import listCommand from '../commands/list.js';
import openCommand from '../commands/open.js';
import mvCommand from '../commands/mv.js';
import projectCommands from '../commands/project.js';
import themeCommand from '../commands/theme.js';
import moduleCommand from '../commands/module.js';
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
import { uiLogger } from '../lib/ui/logger.js';

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

  if (msg === null) {
    yargs.showHelp('log');
    process.exit(EXIT_CODES.SUCCESS);
  } else {
    process.exit(EXIT_CODES.ERROR);
  }
}

const argv = yargs(process.argv.slice(2))
  .usage('The command line interface to interact with HubSpot.')
  // loadConfigMiddleware loads the new hidden config for all commands
  .middleware([
    setCLILogLevel,
    setRequestHeaders,
    handleDeprecatedEnvVariables,
    loadAndValidateConfigMiddleware,
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

  // CMS Design Manager
  .command(watchCommand)
  .command(listCommand)
  .command(uploadCommand)
  .command(fetchCommand)
  .command(removeCommand)
  .command(mvCommand)

  // CMS Commands
  .command(cmsCommand)
  .command(logsCommand)
  .command(lintCommand)
  .command(hubdbCommand)
  .command(createCommand)
  .command(filemanagerCommand)
  .command(functionCommands)
  .command(themeCommand)
  .command(moduleCommand)

  // Misc commands
  .command(customObjectCommand)
  .command(completionCommand)
  .command(doctorCommand)
  .command(mcpCommand)

  .help()
  .alias('h', 'help')
  .recommendCommands()
  .demandCommand(1, '')
  .wrap(getTerminalWidth())
  .strict().argv;

if ('help' in argv && argv.help !== undefined) {
  (async () => {
    await trackHelpUsage(getCommandName(argv));
  })();
}

if ('convertFields' in argv && argv.convertFields !== undefined) {
  (async () => {
    await trackConvertFieldsUsage(getCommandName(argv));
  })();
}
