const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { ensureProjectExists } = require('../projects');
const { uiAccountDescription } = require('../ui');

const i18nKey = 'cli.lib.prompts.projectNamePrompt';

const projectNamePrompt = (accountId, options = {}) => {
  return promptUser({
    name: 'projectName',
    message: i18n(`${i18nKey}.enterName`),
    when: !options.project,
    validate: async val => {
      if (typeof val !== 'string' || !val) {
        return i18n(`${i18nKey}.errors.invalidName`);
      }
      const projectExists = await ensureProjectExists(accountId, val, {
        allowCreate: false,
        noLogs: true,
      });
      if (!projectExists) {
        return i18n(`${i18nKey}.errors.projectDoesNotExist`, {
          projectName: val,
          accountIdentifier: uiAccountDescription(accountId),
        });
      }
      return true;
    },
  });
};

module.exports = {
  projectNamePrompt,
};
