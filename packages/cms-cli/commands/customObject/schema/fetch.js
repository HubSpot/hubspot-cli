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
const { downloadSchema } = require('@hubspot/cms-lib/schema');

exports.command = 'fetch <schemaObjectType> [dest]';
exports.describe = 'Fetch a custom object schema given a schemaObjectType';

exports.handler = async options => {
  let { schemaObjectType, dest, clean } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('custom-object-schema-fetch', null, portalId);

  try {
    await downloadSchema(portalId, schemaObjectType, dest, clean);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to fetch ${schemaObjectType}`);
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema fetch schemaId',
      'Fetch `schemaId` schema and put it in the current working directory',
    ],
    [
      '$0 custom-object schema fetch schemaId my/folder',
      'Fetch `schemaId` schema and put it in a directory named my/folder',
    ],
  ]);

  yargs.positional('schemaObjectType', {
    describe: 'Fully qualified name or object type ID of the target schema.',
    type: 'string',
  });

  yargs.positional('dest', {
    describe:
      'Local folder where schema will be written.  If omitted, current working directory will be used',
    type: 'string',
  });

  yargs.option('clean', {
    describe:
      'When fetching the schema, strip off any portal-specific properties',
    type: 'boolean',
  });
};
