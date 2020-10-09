const { getRoutes } = require('@hubspot/cms-lib/api/function');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { outputFunctions } = require('@hubspot/cms-lib/lib/functions');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');

const {
  addConfigOptions,
  addPortalOptions,
  addUseEnvironmentOptions,
  getPortalId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validatePortal } = require('../../lib/validation');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
};

exports.command = 'list';
exports.describe = 'List currently deployed functions';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { json, compact } = options;
  const portalId = getPortalId(options);

  trackCommandUsage('functions-list', { json, compact }, portalId);

  logger.debug('Getting currently deployed functions');

  const routesResp = await getRoutes(portalId).catch(async e => {
    await logServerlessFunctionApiErrorInstance(
      portalId,
      e,
      new ApiErrorContext({ portalId })
    );
    process.exit();
  });

  logger.debug(`Retrieving logs for functionId: ${routesResp.id}`);

  return outputFunctions(routesResp, options);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs
    .options({
      compact: {
        describe: 'output compact data',
        type: 'boolean',
      },
      json: {
        describe: 'output raw json data',
        type: 'boolean',
      },
    })
    .conflicts('compact', 'json');
};
