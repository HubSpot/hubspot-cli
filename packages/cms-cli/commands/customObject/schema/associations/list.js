const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { validatePortal } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const {
  addConfigOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../../lib/commonOpts');
const { logDebugInfo } = require('../../../lib/debugInfo');
// const { listSchemas } = require('@hubspot/cms-lib/api/schema');

exports.command = 'list';
exports.describe = 'List schemas available on your portal';

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('schema-association-list', null, portalId);

  try {
    // await listSchemas(portalId);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to list associations`);
  }
};

exports.builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);
};
