const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const {
  validatePortal,
  isFileValidJSON,
} = require('../../../../lib/validation');
const { getAbsoluteFilePath } = require('@hubspot/cms-lib/path');
const { trackCommandUsage } = require('../../../../lib/usageTracking');
const { setLogLevel, getPortalId } = require('../../../../lib/commonOpts');
const { logDebugInfo } = require('../../../../lib/debugInfo');
// const { getEnv } = require('@hubspot/cms-lib/lib/config');

exports.command = 'create <schemaObjectType> <definition>';
exports.describe = 'Create a Custom Object Schema Association';

exports.handler = async options => {
  const { definition, schemaObjectType } = options;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);

  trackCommandUsage('schema-association-create', null, portalId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(1);
  }

  try {
    // const res = await createSchema(portalId, filePath);
    // logger.success(
    //   `Schema can be viewed at ${
    //     getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
    //   }/contacts/${portalId}/objects/${res.objectTypeId}`
    // );
  } catch (e) {
    logErrorInstance(e, { portalId });
    logger.error(
      `Association to ${schemaObjectType} creation from ${definition} failed`
    );
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema associations create schemaObjectType definition',
      'Create an association to `schemaObjectType` from a file located at `definition`',
    ],
  ]);

  yargs.positional('schemaObjectType', {
    describe: 'Fully qualified name or object type ID of the target schema.',
    type: 'string',
  });

  yargs.positional('definition', {
    describe:
      'local path to JSON file containing association definitions.  Can be a single association or an array of associations',
    type: 'string',
  });
};
