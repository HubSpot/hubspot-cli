const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const { start: startTestServer } = require('@hubspot/serverless-dev-runtime');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.functions.subcommands.server';

exports.command = 'server <path>';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-server', null, accountId);

  logger.debug(
    i18n(`${i18nKey}.debug.startingServer`, {
      functionPath,
    })
  );

  startTestServer({
    accountId,
    ...options,
  });
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  yargs.option('port', {
    describe: i18n(`${i18nKey}.options.port.describe`),
    type: 'string',
    default: 5432,
  });
  yargs.option('contact', {
    describe: i18n(`${i18nKey}.options.contact.describe`),
    type: 'boolean',
    default: true,
  });
  yargs.option('watch', {
    describe: i18n(`${i18nKey}.options.watch.describe`),
    type: 'boolean',
    default: true,
  });
  yargs.option('log-output', {
    describe: i18n(`${i18nKey}.options.logOutput.describe`),
    type: 'boolean',
    default: false,
  });

  yargs.example([
    [
      '$0 functions server ./tmp/myFunctionFolder.functions',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
