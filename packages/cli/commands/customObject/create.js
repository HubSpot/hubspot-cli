const { logger } = require('@hubspot/local-dev-lib/logger');
const { logApiErrorInstance } = require('../../lib/errorHandlers/apiErrors');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const {
  checkAndConvertToJson,
  loadAndValidateOptions,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { getAccountId } = require('../../lib/commonOpts');
const {
  batchCreateObjects,
} = require('@hubspot/local-dev-lib/api/customObjects');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.customObject.subcommands.create';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create <name> <definition>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { definition, name } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-batch-create', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  const objectJson = checkAndConvertToJson(filePath);

  if (!objectJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await batchCreateObjects(accountId, name, objectJson);
    logger.success(i18n(`${i18nKey}.success.objectsCreated`));
  } catch (e) {
    logApiErrorInstance(e, { accountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition,
      })
    );
  }
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.positional('definition', {
    describe: i18n(`${i18nKey}.positionals.definition.describe`),
    type: 'string',
  });
};
