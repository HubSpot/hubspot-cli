const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { validatePortal } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { setLogLevel, getPortalId } = require('../../../lib/commonOpts');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { deleteSchema } = require('@hubspot/cms-lib/api/schema');

exports.command = 'delete <name>';
exports.describe = 'Delete a custom object schema';

exports.handler = async options => {
  let { name } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('custom-object-schema-delete', null, portalId);

  try {
    await deleteSchema(portalId, name);
    logger.success(`Successfully initiated deletion of ${name}`);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to delete ${name}`);
  }
};

exports.builder = yargs => {
  yargs.example([
    ['$0 schema delete schemaName', 'Delete `schemaName` schema'],
  ]);

  yargs.positional('name', {
    describe: 'Name of the target schema',
    type: 'string',
  });
};
