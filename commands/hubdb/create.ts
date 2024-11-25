// @ts-nocheck
const path = require('path');

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { createHubDbTable } = require('@hubspot/local-dev-lib/hubdb');
const { untildify, isValidPath } = require('@hubspot/local-dev-lib/path');
const { promptUser } = require('../../lib/prompts/promptUtils');
const {
  checkAndConvertToJson,
  loadAndValidateOptions,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.create';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create';
exports.describe = i18n(`${i18nKey}.describe`);

function selectPathPrompt(options) {
  return promptUser([
    {
      name: 'path',
      message: i18n(`${i18nKey}.enterPath`),
      when: !options.path,
      validate: (input: string) => {
        if (!input) {
          return i18n(`${i18nKey}.errors.pathRequired`);
        }
        if (!isValidPath(input)) {
          return i18n(`${i18nKey}.errors.invalidCharacters`);
        }
        return true;
      },
      filter: (input: string) => {
        return untildify(input);
      },
    },
  ]);
}

exports.handler = async options => {
  const { derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-create', null, derivedAccountId);

  let filePath;
  try {
    const { path: filePath } =
      'path' in options
        ? path.resolve(getCwd(), options.path)
        : await selectPathPrompt(options);
    if (!checkAndConvertToJson(filePath)) {
      process.exit(EXIT_CODES.ERROR);
    }

    const table = await createHubDbTable(
      derivedAccountId,
      path.resolve(getCwd(), filePath)
    );
    logger.success(
      i18n(`${i18nKey}.success.create`, {
        accountId: derivedAccountId,
        rowCount: table.rowCount,
        tableId: table.tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.create`, {
        filePath,
      })
    );
    logError(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.options('path', {
    describe: i18n(`${i18nKey}.options.path.describe`),
    type: 'string',
  });
};
