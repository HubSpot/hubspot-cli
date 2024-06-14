jest.mock('../../../lib/commonOpts');
jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('../../../lib/validation');
jest.mock('../../../lib/projects');
jest.mock('../../../lib/prompts/projectNamePrompt');
jest.mock('../../../lib/prompts/buildIdPrompt');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('../../../lib/usageTracking');

const {
  handler,
  describe: deployDescribe,
  command,
  builder,
} = require('../deploy');

const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../../lib/commonOpts');

const {
  deployProject,
  fetchProject,
} = require('@hubspot/local-dev-lib/api/projects');
const { loadAndValidateOptions } = require('../../../lib/validation');
const { getProjectConfig, pollDeployStatus } = require('../../../lib/projects');
const { projectNamePrompt } = require('../../../lib/prompts/projectNamePrompt');
const { buildIdPrompt } = require('../../../lib/prompts/buildIdPrompt');
const { i18n } = require('../../../lib/lang');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const yargs = require('yargs');
const { options } = require('yargs');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

describe('commands/project/deploy', () => {
  const projectFlag = 'project';
  const buildFlag = 'buildId';
  const buildAliases = ['build'];

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(deployDescribe).toContain('[BETA]');
    });
    it('should provide an accurate description of what the command is doing', () => {
      expect(deployDescribe).toMatch(/Deploy a project build$/);
    });
  });

  describe('command', () => {
    it('should the correct command structure', () => {
      expect(command).toEqual(`deploy [--${projectFlag}] [--${buildFlag}]`);
    });
  });

  describe('builder', () => {
    it('should add the correct options', () => {
      builder(yargs);
      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        [projectFlag]: {
          describe: 'Project name',
          type: 'string',
        },
        [buildFlag]: {
          alias: buildAliases,
          describe: 'Project build ID to be deployed',
          type: 'number',
        },
      });
    });

    it('should add the correct examples', () => {
      builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
      expect(yargs.example).toHaveBeenCalledWith([
        ['$0 project deploy', 'Deploy the latest build of the current project'],
        [
          `$0 project deploy --${projectFlag}="my-project" --${buildFlag}=5`,
          'Deploy build 5 of the project my-project',
        ],
      ]);
    });

    it('should add the config options', () => {
      builder(yargs);
      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the account options', () => {
      builder(yargs);
      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the environment options', () => {
      builder(yargs);
      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should the yargs object it is passed', () => {
      expect(builder(yargs)).toEqual(yargs);
    });
  });

  describe('handler', () => {
    let projectConfig;
    let processExitSpy;
    const accountId = 1234567890;
    const accountType = 'STANDARD';
    let options;
    const projectDetails = {
      latestBuild: { buildId: 8 },
      deployedBuild: 1,
    };
    const deployDetails = {
      id: 123,
    };

    beforeEach(() => {
      options = {
        project: 'project name from options',
        buildId: 2,
        accountId,
      };
      projectConfig = {
        name: 'project name from config',
      };
      getProjectConfig.mockResolvedValue({ projectConfig });
      projectNamePrompt.mockResolvedValue({ projectName: 'fooo' });
      getAccountId.mockReturnValue(accountId);
      getAccountConfig.mockReturnValue({ accountType });
      fetchProject.mockResolvedValue(projectDetails);
      deployProject.mockResolvedValue(deployDetails);

      // Spy on process.exit so our tests don't close when it's called
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Simulating process exit');
      });
    });

    it('should load and validate the options', async () => {
      await handler(options);
      expect(loadAndValidateOptions).toHaveBeenCalledTimes(1);
      expect(loadAndValidateOptions).toHaveBeenCalledWith(options);
    });

    it('should get the account id from the options', async () => {
      await handler(options);
      expect(getAccountId).toHaveBeenCalledTimes(1);
      expect(getAccountId).toHaveBeenCalledWith(options);
    });

    it('should load the account config for the correct account id', async () => {
      await handler(options);
      expect(getAccountConfig).toHaveBeenCalledTimes(1);
      expect(getAccountConfig).toHaveBeenCalledWith(accountId);
    });

    it('should track the command usage', async () => {
      await handler(options);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-deploy',
        { type: accountType },
        accountId
      );
    });

    it('should load the project config', async () => {
      await handler(options);
      expect(getProjectConfig).toHaveBeenCalledTimes(1);
      expect(getProjectConfig).toHaveBeenCalledWith();
    });

    it('should load the project config', async () => {
      await handler(options);
      expect(getProjectConfig).toHaveBeenCalledTimes(1);
      expect(getProjectConfig).toHaveBeenCalledWith();
    });

    it('should prompt for the project name', async () => {
      await handler(options);
      expect(projectNamePrompt).toHaveBeenCalledTimes(1);
      expect(projectNamePrompt).toHaveBeenCalledWith(accountId, {
        project: options.project,
      });
    });

    it('should use the project name from the config is a project options is not provided', async () => {
      delete options.project;
      await handler(options);
      expect(projectNamePrompt).toHaveBeenCalledTimes(1);
      expect(projectNamePrompt).toHaveBeenCalledWith(accountId, {
        project: projectConfig.name,
      });
    });

    it('should fetch the project details', async () => {
      await handler(options);
      expect(fetchProject).toHaveBeenCalledTimes(1);
      expect(fetchProject).toHaveBeenCalledWith(accountId, options.project);
    });

    it('should use the name from the prompt if no others are defined', async () => {
      delete options.project;
      const promptProjectName = 'project name from the prompt';
      projectNamePrompt.mockReturnValue({ projectName: promptProjectName });
      getProjectConfig.mockResolvedValue({});

      await handler(options);

      expect(projectNamePrompt).toHaveBeenCalledTimes(1);
      expect(projectNamePrompt).toHaveBeenCalledWith(accountId, {});
      expect(fetchProject).toHaveBeenCalledTimes(1);
      expect(fetchProject).toHaveBeenCalledWith(accountId, promptProjectName);
    });

    it('should log an error and exit when latest build is not defined', async () => {
      fetchProject.mockResolvedValue({});
      await expect(async () => await handler(options)).rejects.toThrow(
        'Simulating process exit'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Deploy error: no builds for this project were found.'
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(pollDeployStatus).not.toHaveBeenCalled();
    });

    it('should deploy the project', async () => {
      await handler(options);
      expect(deployProject).toHaveBeenCalledTimes(1);
      expect(deployProject).toHaveBeenCalledWith(
        accountId,
        options.project,
        options.buildId
      );
    });

    it('should poll the deploy status', async () => {
      await handler(options);
      expect(pollDeployStatus).toHaveBeenCalledTimes(1);
      expect(pollDeployStatus).toHaveBeenCalledWith(
        accountId,
        options.project,
        deployDetails.id,
        options.buildId
      );
    });
  });
});
