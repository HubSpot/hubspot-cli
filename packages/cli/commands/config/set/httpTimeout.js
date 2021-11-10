const { logger } = require('@hubspot/cli-lib/logger');
const { updateHttpTimeout } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const { getAccountId, setLogLevel } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { validateAccount } = require('../../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.config.subcommands.set.subcommands.httpTimeout';

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

exports.command = 'http-timeout [timeout]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const { timeout } = options;

  trackCommandUsage('config-set-http-timeout', {}, accountId);

  updateHttpTimeout(timeout);

  return logger.success(i18n(`${i18nKey}.success.timeoutUpdated`, { timeout }));
};

exports.builder = yargs => {
  yargs.positional('timeout', {
    describe: i18n(`${i18nKey}.positionals.timeout.describe`),
    type: 'string',
    default: 30000,
  });

  yargs.example([
    ['$0 config set http-timeout 30000', i18n(`${i18nKey}.examples.default`)],
  ]);

  return yargs;
};
