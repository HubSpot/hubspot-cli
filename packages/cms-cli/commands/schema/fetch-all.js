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
const { downloadMultipleSchema } = require('@hubspot/cms-lib/api/schema');

exports.command = 'fetch-all [dest]';
exports.describe = 'Fetch all Custom Object Schema for a portal';

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('schema-fetch-all', null, portalId);

  try {
    await downloadMultipleSchema(portalId, options.dest);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to fetch schema`);
  }
};

exports.builder = yargs => {
  addPortalOptions(yargs, true);
  addConfigOptions(yargs, true);

  yargs.example([
    [
      '$0 schema fetch',
      'Fetch all schema for a portal and put them in the current working directory',
    ],
    [
      '$0 schema fetch my/folder',
      'Fetch all schema for a portal and put them in a directory named my/folder',
    ],
  ]);

  yargs.positional('dest', {
    describe:
      'Local destination folder to write schema to.  If omitted, current working directory will be used',
    type: 'string',
  });
};
