const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { ensureProjectExists } = require('../projects');

const i18nKey = 'cli.lib.prompts.projectNamePrompt';

const projectNamePrompt = accountId => {
  return promptUser({
    name: 'projectName',
    message: i18n(`${i18nKey}.enterName`),
    validate: async val => {
      if (typeof val !== 'string') {
        return i18n(`${i18nKey}.errors.invalidName`);
      }
      const projectExists = await ensureProjectExists(accountId, val, {
        allowCreate: false,
      });

      if (!projectExists) {
        return false;
      }
      return true;
    },
  });
};

module.exports = {
  projectNamePrompt,
};
