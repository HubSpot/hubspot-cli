const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { start: startTestServer } = require('@hubspot/serverless-dev-runtime');
const { validateAccount } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.functions.subcommands.server';

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'server <path>';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-server', { functionPath }, accountId);

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
