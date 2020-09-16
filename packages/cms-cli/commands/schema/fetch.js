const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { downloadSchema } = require('@hubspot/cms-lib/api/schema');

exports.command = 'fetch <schemaObjectType> [dest]';
exports.describe = 'Fetch a Custom Object Schema given a schemaObjectType';

exports.handler = async options => {
  let { schemaObjectType, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('schema-fetch', null, portalId);

  try {
    await downloadSchema(portalId, schemaObjectType, dest);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to fetch ${schemaObjectType}`);
  }
};

exports.builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.example([
    [
      '$0 schema fetch schemaId',
      'Fetch `schemaId` schema and put it in the current working directory',
    ],
    [
      '$0 schema fetch schemaId my/folder',
      'Fetch `schemaId` schema and put it in a directory named my/folder',
    ],
  ]);

  yargs.positional('schemaObjectType', {
    describe: 'Fully qualified name or object type ID of the target schema.',
    type: 'string',
    demand: true,
  });

  yargs.positional('dest', {
    describe:
      'Local destination folder to write schema to.  If omitted, current working directory will be used',
    type: 'string',
  });
};
