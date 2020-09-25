const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { validatePortal } = require('../../../../lib/validation');
const { trackCommandUsage } = require('../../../../lib/usageTracking');
const { setLogLevel, getPortalId } = require('../../../../lib/commonOpts');
const { logDebugInfo } = require('../../../../lib/debugInfo');

exports.command = 'remove <schemaObjectType> <associationId>';
exports.describe = 'Remove an association from a custom object schema.';

exports.handler = async options => {
  let { schemaObjectType, associationId } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('custom-object-schema-association-remove', null, portalId);

  try {
    // await removeSchema(portalId, schemaObjectType);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to remove ${associationId} from ${schemaObjectType}`);
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema associations remove schemaObjectType associationId',
      'Remove `associationId` from `schemaObjectType`',
    ],
  ]);

  yargs.positional('schemaObjectType', {
    describe: 'Fully qualified name or object type ID of the target schema.',
    type: 'string',
  });

  yargs.positional('associationId', {
    describe: 'ID of the association to remove',
    type: 'string',
  });
};
