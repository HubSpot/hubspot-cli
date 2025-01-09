// @ts-nocheck
import { inputPrompt } from '../../lib/prompts/promptUtils';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { getAbsoluteFilePath } = require('@hubspot/local-dev-lib/path');
const { checkAndConvertToJson } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  batchCreateObjects,
} = require('@hubspot/local-dev-lib/api/customObjects');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.customObject.subcommands.create';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path, name: providedName, derivedAccountId } = options;
  let definitionPath = path;
  let name = providedName;

  trackCommandUsage('custom-object-batch-create', null, derivedAccountId);

  if (!name) {
    name = await inputPrompt(i18n(`${i18nKey}.inputName`));
  }

  if (!definitionPath) {
    definitionPath = await inputPrompt(i18n(`${i18nKey}.inputPath`));
  }

  const filePath = getAbsoluteFilePath(definitionPath);
  const objectJson = checkAndConvertToJson(filePath);

  if (!objectJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await batchCreateObjects(derivedAccountId, name, objectJson);
    logger.success(i18n(`${i18nKey}.success.objectsCreated`));
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition: definitionPath,
      })
    );
  }
};

exports.builder = yargs => {
  yargs
    .positional('name', {
      describe: i18n(`${i18nKey}.positionals.name.describe`),
      type: 'string',
    })
    .option('path', {
      describe: i18n(`${i18nKey}.options.path.describe`),
      type: 'string',
    });
};
