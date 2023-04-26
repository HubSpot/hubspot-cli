const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { uiAccountDescription } = require('../ui');
const { isSandbox } = require('../sandboxes');
const { getAccountId } = require('@hubspot/cli-lib');

const i18nKey = 'cli.lib.prompts.projectDevTargetAccountPrompt';

const selectTargetAccountPrompt = async (accounts, nonSandbox = false) => {
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
    choices = [
      {
        name: i18n(`${i18nKey}.createNewSandboxOption`),
        value: {
          targetAccountId: null,
          chooseNonSandbox: false,
          createNewSandbox: true,
        },
      },
      ...accounts.filter(isSandbox).map(accountConfig => {
        const accountId = getAccountId(accountConfig.name);
        return {
          name: uiAccountDescription(accountId),
          value: {
            targetAccountId: accountId,
            chooseNonSandbox: false,
            createNewSandbox: false,
          },
        };
      }),
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