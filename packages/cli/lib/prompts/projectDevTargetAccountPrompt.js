const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { uiAccountDescription } = require('../ui');
const { isSandbox } = require('../sandboxes');
const { getAccountId } = require('@hubspot/cli-lib');

const i18nKey = 'cli.lib.prompts.projectDevTargetAccountPrompt';

const SPECIAL_PROMPT_VALUES = {
  CREATE_SANDBOX: true,
  NON_SANDBOX: false,
};

const selectTargetAccountPrompt = (accounts, nonSandbox = false) => {
  let choices;

  if (nonSandbox) {
    choices = accounts
      .filter(accountConfig => !isSandbox(accountConfig))
      .map(accountConfig => {
        const accountId = getAccountId(accountConfig.name);
        return {
          name: uiAccountDescription(accountId),
          value: accountId,
        };
      });
  } else {
    choices = [
      {
        name: i18n(`${i18nKey}.createNewSandboxOption`),
        value: SPECIAL_PROMPT_VALUES.CREATE_SANDBOX,
      },
      ...accounts.filter(isSandbox).map(accountConfig => {
        const accountId = getAccountId(accountConfig.name);
        return {
          name: uiAccountDescription(accountId),
          value: accountId,
        };
      }),
      {
        name: i18n(`${i18nKey}.chooseNonSandboxOption`),
        value: SPECIAL_PROMPT_VALUES.NON_SANDBOX,
      },
    ];
  }
  return promptUser([
    {
      name: 'targetAccountId',
      type: 'list',
      message: nonSandbox
        ? i18n(`${i18nKey}.chooseNonSandboxAccount`)
        : i18n(`${i18nKey}.chooseSandboxAccount`),
      choices,
    },
  ]);
};

module.exports = {
  selectTargetAccountPrompt,
  SPECIAL_PROMPT_VALUES,
};
