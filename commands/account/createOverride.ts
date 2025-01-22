// @ts-nocheck
const fs = require('fs-extra');
const path = require('path');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getConfigPath,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');
const { addConfigOptions } = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');
import { EXIT_CODES } from '../../lib/enums/exitCodes';
const { selectAccountFromConfig } = require('../../lib/prompts/accountsPrompt');

const i18nKey = 'commands.account.subcommands.createOverride';
exports.describe = null; // i18n(`${i18nKey}.describe`);

exports.command = 'create-override [account]';

exports.handler = async options => {
  let overrideDefaultAccount = options.account;

  if (!overrideDefaultAccount) {
    overrideDefaultAccount = await selectAccountFromConfig();
  } else if (!getAccountId(overrideDefaultAccount)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: overrideDefaultAccount,
        configPath: getConfigPath(),
      })
    );
    overrideDefaultAccount = await selectAccountFromConfig();
  }
  const accountId = getAccountId(overrideDefaultAccount);

  try {
    const overrideFilePath = path.join(getCwd(), '.hs-account');
    await fs.writeFile(overrideFilePath, accountId.toString(), 'utf8');
    logger.success(i18n(`${i18nKey}.success`, { overrideFilePath }));
  } catch (e) {
    logger.error(i18n(`${i18nKey}.errors.writeFile`, { error: e.message }));
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);

  yargs.example([
    ['$0 accounts create-override', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts create-override 12345678',
      i18n(`${i18nKey}.examples.withAccountId`),
    ],
  ]);

  return yargs;
};
