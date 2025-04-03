// @ts-nocheck
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { ensureProjectExists } = require('../projects');
const { uiAccountDescription } = require('../ui');


const projectNamePrompt = (accountId, options = {}) => {
  return promptUser({
    name: 'projectName',
    message: i18n(`lib.prompts.projectNamePrompt.enterName`),
    when: !options.project,
    validate: async val => {
      if (typeof val !== 'string' || !val) {
        return i18n(`lib.prompts.projectNamePrompt.errors.invalidName`);
      }
      const { projectExists } = await ensureProjectExists(accountId, val, {
        allowCreate: false,
        noLogs: true,
      });
      if (!projectExists) {
        return i18n(`lib.prompts.projectNamePrompt.errors.projectDoesNotExist`, {
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
