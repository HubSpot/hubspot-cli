const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { accountNameExistsInConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'lib.prompts.developerTestAccountPrompt';

const developerTestAccountNamePrompt = currentPortalCount => {
  return promptUser([
    {
      name: 'name',
      message: i18n(`${i18nKey}.name.message`),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.name.errors.invalidName`);
        } else if (!val.length) {
          return i18n(`${i18nKey}.name.errors.nameRequired`);
        }
        return accountNameExistsInConfig(val)
          ? i18n(`${i18nKey}.name.errors.accountNameExists`, { name: val })
          : true;
      },
      default: `Developer test account ${currentPortalCount + 1}`,
    },
  ]);
};

module.exports = {
  developerTestAccountNamePrompt,
};
