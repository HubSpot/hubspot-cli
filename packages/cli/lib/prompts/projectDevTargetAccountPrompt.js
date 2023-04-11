const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { uiAccountDescription } = require('../ui');

const i18nKey = 'cli.lib.prompts.projectDevTargetAccountPrompt';

const selectTargetAccountPrompt = accountId => {
  return promptUser([
    {
      name: 'targetAccountId',
      type: 'list',
      message: i18n(`${i18nKey}.account`),
      choices: [
        {
          name: '<create a new sandbox account>',
          value: null,
        },
        {
          name: '[sandbox] my-dev-sandbox-1',
          value: null,
        },
        {
          name: `[non-sandbox] ${uiAccountDescription(accountId)}`,
          value: accountId,
        },
      ],
    },
  ]);
};

module.exports = {
  selectTargetAccountPrompt,
};
