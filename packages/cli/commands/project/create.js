const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { getCwd } = require('@hubspot/cli-lib/path');
const path = require('path');
const { prompt } = require('inquirer');
const { createProjectConfig } = require('../../lib/projects');
const { PROJECT_TEMPLATES } = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.create';

exports.command = 'create';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const { name, template, location } = await prompt([
    {
      name: 'name',
      message: '[--name] Give your project a name:',
      when: !options.name,
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
      when: !options.location,
      default: answers => {
        return path.resolve(getCwd(), answers.name || options.name);
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
        return options.template &&
          !PROJECT_TEMPLATES.find(t => t.name === options.template)
          ? `[--template] Could not find template ${options.template}. Please choose an available template.`
          : '[--template] Start from a template?';
      },
      when:
        !options.template ||
        !PROJECT_TEMPLATES.find(t => t.name === options.template),
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

  trackCommandUsage('project-create', { projectName: name }, accountId);

  await createProjectConfig(
    path.resolve(getCwd(), options.location || location),
    options.name || name,
    options.template || template
  );
};

exports.builder = yargs => {
  yargs.options({
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    location: {
      describe: i18n(`${i18nKey}.options.location.describe`),
      type: 'string',
    },
    template: {
      describe: i18n(`${i18nKey}.options.template.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project create', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
