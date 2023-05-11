const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiAccountDescription } = require('../ui');
const { isSandbox, getAccountName } = require('../sandboxes');
const { getAccountId } = require('@hubspot/cli-lib');
const { getSandboxUsageLimits } = require('@hubspot/cli-lib/sandboxes');
const { logger } = require('@hubspot/cli-lib/logger');

const i18nKey = 'cli.lib.prompts.projectDevTargetAccountPrompt';

const mapSandboxAccount = accountConfig => ({
  name: getAccountName(accountConfig),
  value: {
    targetAccountId: getAccountId(accountConfig.name),
    chooseNonSandbox: false,
    createNewSandbox: false,
  },
});

const selectTargetAccountPrompt = async (
  accounts,
  defaultAccountConfig,
  nonSandbox = false
) => {
  let choices;

  if (nonSandbox) {
    choices = accounts
      .filter(accountConfig => !isSandbox(accountConfig))
      .map(accountConfig => {
        const accountId = getAccountId(accountConfig.name);
        return {
          name: uiAccountDescription(accountId),
          value: {
            targetAccountId: accountId,
            chooseNonSandbox: false,
            createNewSandbox: false,
          },
        };
      });
  } else {
    let sandboxUsage = {};
    try {
      const accountId = getAccountId(defaultAccountConfig.portalId);
      sandboxUsage = await getSandboxUsageLimits(accountId);
    } catch (err) {
      logger.debug('Unable to fetch sandbox usage limits: ', err);
    }
    const sandboxAccounts = accounts.reverse().filter(isSandbox);
    let disabledMessage = false;
    if (isSandbox(defaultAccountConfig)) {
      disabledMessage = i18n(`${i18nKey}.defaultAccountNotProd`);
    }
    if (
      sandboxUsage['DEVELOPER'] &&
      sandboxUsage['DEVELOPER'].available === 0
    ) {
      disabledMessage = i18n(`${i18nKey}.sandboxLimit`, {
        limit: sandboxUsage['DEVELOPER'].limit,
      });
    }
    // Order choices by Create new -> Developer Sandbox -> Standard Sandbox -> Non sandbox
    choices = [
      {
        name: i18n(`${i18nKey}.createNewSandboxOption`),
        value: {
          targetAccountId: null,
          chooseNonSandbox: false,
          createNewSandbox: true,
        },
        disabled: disabledMessage,
      },
      ...sandboxAccounts
        .filter(a => a.sandboxAccountType === 'DEVELOPER')
        .map(mapSandboxAccount),
      ...sandboxAccounts
        .filter(a => a.sandboxAccountType === 'STANDARD')
        .map(mapSandboxAccount),
      {
        name: i18n(`${i18nKey}.chooseNonSandboxOption`),
        value: {
          targetAccountId: null,
          chooseNonSandbox: true,
          createNewSandbox: false,
        },
      },
    ];
  }
  const { targetAccountInfo } = await promptUser([
    {
      name: 'targetAccountInfo',
      type: 'list',
      message: nonSandbox
        ? i18n(`${i18nKey}.chooseNonSandboxAccount`)
        : i18n(`${i18nKey}.chooseSandboxAccount`),
      choices,
    },
  ]);

  return targetAccountInfo;
};

module.exports = {
  selectTargetAccountPrompt,
};
