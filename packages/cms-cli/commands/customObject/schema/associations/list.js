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
// const { listSchemas } = require('@hubspot/cms-lib/api/schema');

exports.command = 'list <schemaObjectType>';
exports.describe = 'List schemas available on your portal';

exports.handler = async options => {
  // eslint-disable-next-line
  const { schemaObjectType, config } = options;
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('custom-object-schema-association-list', null, portalId);

  try {
    // await listSchemas(portalId);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to list associations`);
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema associations list schemaObjectType',
      'List associations for `schemaObjectType`',
    ],
  ]);

  yargs.positional('schemaObjectType', {
    describe: 'Fully qualified name or object type ID of the target schema.',
    type: 'string',
  });
};
