#!/usr/bin/env node

const { Command } = require('commander');
const updateNotifier = require('update-notifier');

const { logger } = require('@hubspot/cms-lib/logger');
const { configureMainCommand } = require('../commands/main');
const { setLogLevel } = require('../lib/commonOpts');

const pkg = require('../package.json');

const notifier = updateNotifier({ pkg });

notifier.notify({
  shouldNotifyInNpmScript: true,
});

const showCommandNotFoundError = program => {
  setLogLevel(program);
  const { args } = program;
  logger.error('The command "hs %s" is not a valid command', args[0]);
  logger.log('Run "hs --help" for a list of available commands');
  process.exit();
};

const program = new Command();
configureMainCommand(program);
const result = program.parse(process.argv);

// Git-style subcommands return `undefined` when parsed so we leverage that
// to detect when a user attempts to run a command that doesn't exist
if (result && !program.runningCommand) {
  showCommandNotFoundError(program);
}
