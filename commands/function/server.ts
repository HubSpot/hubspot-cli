// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { start: startTestServer } = require('@hubspot/serverless-dev-runtime');
const { i18n } = require('../../lib/lang');

exports.command = 'server <path>';
exports.describe = false;

exports.handler = async options => {
  const { path: functionPath, derivedAccountId } = options;

  trackCommandUsage('functions-server', null, derivedAccountId);

  logger.debug(
    i18n('commands.function.subcommands.server.debug.startingServer', {
      functionPath,
    })
  );

  startTestServer({
    accountId: derivedAccountId,
    ...options,
  });
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n('commands.function.subcommands.server.positionals.path.describe'),
    type: 'string',
  });
  yargs.option('port', {
    describe: i18n('commands.function.subcommands.server.options.port.describe'),
    type: 'string',
    default: 5432,
  });
  yargs.option('contact', {
    describe: i18n('commands.function.subcommands.server.options.contact.describe'),
    type: 'boolean',
    default: true,
  });
  yargs.option('watch', {
    describe: i18n('commands.function.subcommands.server.options.watch.describe'),
    type: 'boolean',
    default: true,
  });
  yargs.option('log-output', {
    describe: i18n('commands.function.subcommands.server.options.logOutput.describe'),
    type: 'boolean',
    default: false,
  });

  yargs.example([
    [
      '$0 functions server ./tmp/myFunctionFolder.functions',
      i18n('commands.function.subcommands.server.examples.default'),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
