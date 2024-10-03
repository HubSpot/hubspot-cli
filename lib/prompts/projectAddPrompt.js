const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.projectAddPrompt';

const projectAddPrompt = async (components, promptOptions = {}) => {
  return promptUser([
    {
      name: 'component',
      message: () => {
        return promptOptions.type &&
          !components.find(t => t.path === promptOptions.type)
          ? i18n(`${i18nKey}.errors.invalidType`, {
              type: promptOptions.type,
            })
          : i18n(`${i18nKey}.selectType`);
      },
      when:
        !promptOptions.type ||
        !components.find(t => t.path === promptOptions.type),
      type: 'list',
      choices: components.map(type => {
        return {
          name: type.label,
          value: type,
        };
      }),
    },
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      when: !promptOptions.name,
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return true;
      },
    },
  ]);
};

module.exports = {
  projectAddPrompt,
};
