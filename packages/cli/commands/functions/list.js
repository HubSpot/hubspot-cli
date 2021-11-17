const { getRoutes } = require('@hubspot/cli-lib/api/functions');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { getFunctionArrays } = require('@hubspot/cli-lib/lib/functions');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.functions.subcommands.list';

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

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { json, compact } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-list', { json, compact }, accountId);

  logger.debug(i18n(`${i18nKey}.debug.gettingFunctions`));

  const routesResp = await getRoutes(accountId).catch(async e => {
    await logApiErrorInstance(accountId, e, new ApiErrorContext({ accountId }));
    process.exit();
  });

  if (!routesResp.objects.length) {
    return logger.info(i18n(`${i18nKey}.info.noFunctions`));
  }

  if (options.json) {
    return logger.log(routesResp.objects);
  }

  const functionsAsArrays = getFunctionArrays(routesResp);
  functionsAsArrays.unshift(
    getTableHeader(['Route', 'Method', 'Secrets', 'Created', 'Updated'])
  );
  return logger.log(getTableContents(functionsAsArrays));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.options({
    json: {
      describe: i18n(`${i18nKey}.options.json.describe`),
      type: 'boolean',
    },
  });
};
