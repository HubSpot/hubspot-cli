const path = require('path');
const { getCwd } = require('@hubspot/cli-lib/path');
const { PROJECT_TEMPLATES } = require('@hubspot/cli-lib/lib/constants');
const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.createProjectPrompt';

const createProjectPrompt = (promptOptions = {}) => {
  return promptUser([
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
    {
      name: 'location',
      message: i18n(`${i18nKey}.enterLocation`),
      when: !promptOptions.location,
      default: answers => {
        return path.resolve(getCwd(), answers.name || promptOptions.name);
      },
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.locationRequired`);
        }
        return true;
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !PROJECT_TEMPLATES.find(t => t.name === promptOptions.template)
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when:
        !promptOptions.template ||
        !PROJECT_TEMPLATES.find(t => t.name === promptOptions.template),
      type: 'list',
      choices: [
        {
          name: i18n(`${i18nKey}.templateOptions.noTemplate`),
          value: 'none',
        },
        ...PROJECT_TEMPLATES.map(template => {
          return {
            name: template.label,
            value: template.name,
          };
        }),
      ],
    },
  ]);
};

module.exports = {
  createProjectPrompt,
};
