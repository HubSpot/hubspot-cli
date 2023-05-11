const { promptUser } = require('./promptUtils');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { i18n } = require('../lang');
const { PROJECT_COMPONENT_TYPES } = require('@hubspot/cli-lib/lib/constants');

const i18nKey = 'cli.lib.prompts.projectAddPrompt';

const createTypeOptions = async () => {
  const config = await fetchJsonFromRepository(
    'HubSpot/hubspot-project-components',
    'main/config.json'
  );

  return config[PROJECT_COMPONENT_TYPES.COMPONENTS];
};

const projectAddPrompt = async (promptOptions = {}) => {
  const components = await createTypeOptions();
  return promptUser([
    {
      name: 'type',
      message: () => {
        return promptOptions.type &&
          !components.find(t => t.path === promptOptions.type.path)
          ? i18n(`${i18nKey}.errors.invalidType`, {
              type: promptOptions.type,
            })
          : i18n(`${i18nKey}.selectType`);
      },
      when:
        !promptOptions.type ||
        !components.find(t => t.path === promptOptions.type.path),
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
