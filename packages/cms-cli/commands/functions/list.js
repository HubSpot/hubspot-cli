const { getRoutes } = require('@hubspot/cms-lib/api/function');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { getFunctionArrays } = require('@hubspot/cms-lib/lib/functions');
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
const { getTableContents, getTableHeader } = require('../../lib/table');

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
    await logApiErrorInstance(portalId, e, new ApiErrorContext({ portalId }));
    process.exit();
  });

  if (!routesResp.objects.length) {
    return logger.info('No functions found.');
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
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.options({
    json: {
      describe: 'output raw json data',
      type: 'boolean',
    },
  });
};
