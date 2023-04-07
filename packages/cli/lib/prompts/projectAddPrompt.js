const { promptUser } = require('./promptUtils');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.projectAddPrompt';

const createTypeOptions = async () => {
  const config = await fetchJsonFromRepository(
    'hubspot-project-components',
    'main/config.json'
  );
  return config.components;
};

const projectAddPrompt = async (promptOptions = {}) => {
  const componentTypes = await createTypeOptions();
  return promptUser([
    {
      name: 'type',
      message: () => {
        return promptOptions.type &&
          !componentTypes.find(t => t.path === promptOptions.type)
          ? i18n(`${i18nKey}.errors.invalidType`, {
              type: promptOptions.type,
            })
          : i18n(`${i18nKey}.selectType`);
      },
      when:
        !promptOptions.type ||
        !componentTypes.find(t => t.path === promptOptions.type),
      type: 'list',
      choices: componentTypes.map(type => {
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
