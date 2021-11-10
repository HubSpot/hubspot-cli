const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { validateAccount } = require('../../lib/validation');
const { getCwd } = require('@hubspot/cli-lib/path');
const path = require('path');
const { prompt } = require('inquirer');
const { createProjectConfig } = require('../../lib/projects');
const { PROJECT_TEMPLATES } = require('@hubspot/cli-lib/lib/constants');
const { EXIT_CODES } = require('../../lib/exitCodes');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.command = 'create';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

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
      describe: 'Project name (cannot be changed)',
      type: 'string',
    },
    location: {
      describe: 'Directory where project should be created',
      type: 'string',
    },
    template: {
      describe: 'Which template?',
      type: 'string',
    },
  });

  yargs.example([['$0 project create', 'Create a project']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
