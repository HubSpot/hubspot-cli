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

exports.command = 'delete <schemaObjectType>';
exports.describe =
  'Delete a Custom Object Schema given a schemaObjectType. Delete operation is asynchronous and may take time to complete even after the command succeeds';

exports.handler = async options => {
  let { schemaObjectType } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('schema-delete', null, portalId);

  try {
    await deleteSchema(portalId, schemaObjectType);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to delete ${schemaObjectType}`);
  }
};

exports.builder = yargs => {
  yargs.example([['$0 schema delete schemaId', 'Delete `schemaId` schema']]);

  yargs.positional('schemaObjectType', {
    describe: 'Fully qualified name or object type ID of the target schema.',
    type: 'string',
  });
};
