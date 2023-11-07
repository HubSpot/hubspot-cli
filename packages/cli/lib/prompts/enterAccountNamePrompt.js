const { accountNameExistsInConfig } = require('@hubspot/local-dev-lib/config');
const { STRING_WITH_NO_SPACES_REGEX } = require('../regex');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.enterAccountNamePrompt';

const accountNamePrompt = defaultName => ({
  name: 'name',
  message: i18n(`${i18nKey}.enterAccountName`),
  default: defaultName,
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidName`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.nameRequired`);
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return i18n(`${i18nKey}.errors.spacesInName`);
    }
    return accountNameExistsInConfig(val)
      ? i18n(`${i18nKey}.errors.accountNameExists`, { name: val })
      : true;
  },
});

const enterAccountNamePrompt = defaultName => {
  return promptUser(accountNamePrompt(defaultName));
};

module.exports = {
  accountNamePrompt,
  enterAccountNamePrompt,
};
