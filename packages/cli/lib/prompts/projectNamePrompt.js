const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.projectNamePrompt';

const projectNamePrompt = () => {
  return promptUser([
    {
      name: 'projectName',
      message: i18n(`${i18nKey}.enterName`),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidName`);
        }
        return true;
      },
    },
  ]);
};

module.exports = {
  projectNamePrompt,
};
