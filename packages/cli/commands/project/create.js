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
// const { getCwd } = require('@hubspot/cli-lib/path');
// const path = require('path');
const { prompt } = require('inquirer');
const {
  createProjectConfig,
  showWelcomeMessage,
} = require('../../lib/projects');
const { PROJECT_TEMPLATES } = require('@hubspot/cli-lib/lib/constants');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'create [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  // const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();

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
        return answers.name || options.name;
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
      message: 'Start from a template?',
      when: !options.template,
      type: 'rawlist',
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

  await createProjectConfig(location, name, template);

  showWelcomeMessage(name, accountId);
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
    temlate: {
      describe: 'Which template?',
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project create myProjectFolder',
      'Create a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
