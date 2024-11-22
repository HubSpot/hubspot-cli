// @ts-nocheck
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { uiCommandReference } from '../../lib/ui';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { addSecret } = require('@hubspot/local-dev-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { uiAccountDescription } = require('../../lib/ui');
const {
  secretValuePrompt,
  secretNamePrompt,
} = require('../../lib/prompts/secretPrompt');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.secrets.subcommands.add';

exports.command = 'add [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name } = options;
  let secretName = name;
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-add', null, accountId);

  try {
    if (!secretName) {
      const { secretName: name } = await secretNamePrompt();
      secretName = name;
    }

    const {
      data: { results: secrets },
    } = await fetchSecrets(accountId);

    if (secrets.includes(secretName)) {
      logger.error(
        i18n(`${i18nKey}.errors.alreadyExists`, {
          secretName,
          command: uiCommandReference('hs secret update'),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }

    const { secretValue } = await secretValuePrompt();

    await addSecret(accountId, secretName, secretValue);
    logger.success(
      i18n(`${i18nKey}.success.add`, {
        accountIdentifier: uiAccountDescription(accountId),
        secretName,
      })
    );
  } catch (err) {
    logger.error(
      i18n(`${i18nKey}.errors.add`, {
        secretName,
      })
    );
    logError(
      err,
      new ApiErrorContext({
        request: 'add secret',
        accountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  return yargs;
};
