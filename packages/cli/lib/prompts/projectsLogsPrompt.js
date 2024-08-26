const { i18n } = require('../lang');
const { promptUser } = require('./promptUtils');

const i18nKey = 'lib.prompts.projectLogsPrompt';

const projectLogsPrompt = async ({ functionChoices, promptOptions = {} }) => {
  if (!functionChoices) {
    return {};
  }
  if (functionChoices && functionChoices.length === 1) {
    return { functionName: functionChoices[0] };
  }

  return promptUser([
    {
      name: 'functionName',
      type: 'list',
      message: i18n(`${i18nKey}.functionName`),
      when: () => !promptOptions || !promptOptions.function,
      choices: functionChoices,
    },
  ]);
};

module.exports = {
  projectLogsPrompt,
};
