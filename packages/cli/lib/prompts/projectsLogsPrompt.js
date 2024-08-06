const { i18n } = require('../lang');
const { promptUser } = require('./promptUtils');
const { SERVERLESS_FUNCTION_TYPES } = require('../constants');

const i18nKey = 'lib.prompts.projectLogsPrompt';

const projectLogsPrompt = ({
  generateAppChoices,
  generateFunctionTypeChoices,
  generateFunctionNameChoices,
  promptOptions = {},
}) => {
  return promptUser([
    {
      name: 'app',
      type: 'list',
      message: i18n(`${i18nKey}.appName`),
      when: ({ logType }) => {
        return !promptOptions.app && !promptOptions.endpoint;
      },
      choices: generateAppChoices,
    },
    // {
    //   name: 'logType',
    //   type: 'list',
    //   message: i18n(`${i18nKey}.logType.message`),
    //   when:
    //     !promptOptions.app &&
    //     !promptOptions.function &&
    //     !promptOptions.endpoint,
    //   choices: generateFunctionTypeChoices,
    // },
    // {
    //   name: 'functionName',
    //   message: i18n(`${i18nKey}.functionName`),
    //   when: ({ logType }) => {
    //     return (
    //       (promptOptions.app ||
    //         logType === SERVERLESS_FUNCTION_TYPES.APP_FUNCTION) &&
    //       !promptOptions.function &&
    //       !promptOptions.endpoint
    //     );
    //   },
    //   choices: generateFunctionNameChoices,
    // },
    // {
    //   name: 'endpointName',
    //   message: i18n(`${i18nKey}.endpointName`),
    //   when: ({ logType }) => {
    //     return (
    //       logType === SERVERLESS_FUNCTION_TYPES.PUBLIC_ENDPOINT &&
    //       !promptOptions.function &&
    //       !promptOptions.endpoint
    //     );
    //   },
    // },
  ]);
};

module.exports = {
  projectLogsPrompt,
};
