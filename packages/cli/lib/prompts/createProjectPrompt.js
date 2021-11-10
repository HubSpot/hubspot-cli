const path = require('path');
const { getCwd } = require('@hubspot/cli-lib/path');
const { PROJECT_TEMPLATES } = require('@hubspot/cli-lib/lib/constants');
const { promptUser } = require('./promptUtils');

const createProjectPrompt = (promptOptions = {}) => {
  return promptUser([
    {
      name: 'name',
      message: '[--name] Give your project a name:',
      when: !promptOptions.name,
      validate: input => {
        if (!input) {
          return 'A project name is required';
        }
        return true;
      },
    },
    {
      name: 'location',
      message: '[--location] Where should the project be created?',
      when: !promptOptions.location,
      default: answers => {
        return path.resolve(getCwd(), answers.name || promptOptions.name);
      },
      validate: input => {
        if (!input) {
          return 'A project location is required';
        }
        return true;
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !PROJECT_TEMPLATES.find(t => t.name === promptOptions.template)
          ? `[--template] Could not find template ${promptOptions.template}. Please choose an available template.`
          : '[--template] Start from a template?';
      },
      when:
        !promptOptions.template ||
        !PROJECT_TEMPLATES.find(t => t.name === promptOptions.template),
      type: 'list',
      choices: [
        {
          name: 'No template',
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
