const { i18n } = require('../lang');
const { promptUser } = require('./promptUtils');

const i18nKey = 'lib.prompts.projectLogsPrompt';

const projectLogsPrompt = async ({
  functionChoices,
  promptOptions,
  projectName = {},
}) => {
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
      message: i18n(`${i18nKey}.functionName`, { projectName }),
      when: () =>
        (!promptOptions || !promptOptions.function) &&
        functionChoices.length > 0,
      choices: functionChoices,
    },
  ]);
};

module.exports = {
  projectLogsPrompt,
};
