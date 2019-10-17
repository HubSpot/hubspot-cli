#!/usr/bin/env node

const { Command } = require('commander');
const { version } = require('../package.json');

const { logger } = require('@hubspot/cms-lib/logger');

const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'sync';
const program = new Command(`hscms ${COMMAND_NAME}`);

program
  .version(version)
  .arguments('<src> <dest>')
  .action((src, dest, command) => {
    setLogLevel(command);
    logDebugInfo(command);

    trackCommandUsage(COMMAND_NAME, {});

    logger.error(`The folder ${src} was not uploaded`);
    logger.log('');
    logger.log(
      'Support for uploading a folder has been removed from the the "sync" command'
    );
    logger.log('To upload a folder of files, please use the "upload" command');
    logger.log('');
  });

addLoggerOptions(program);
addHelpUsageTracking(program, COMMAND_NAME);

program.parse(process.argv);
