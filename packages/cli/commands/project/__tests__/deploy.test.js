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
jest.mock('../../../lib/ui');

const libUi = jest.requireActual('../../../lib/ui');
const {
  uiCommandReference,
  uiAccountDescription,
  uiBetaTag,
  uiLink,
} = require('../../../lib/ui');

uiBetaTag.mockImplementation(libUi.uiBetaTag);

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
const {
  getProjectConfig,
  pollDeployStatus,
  getProjectDetailUrl,
} = require('../../../lib/projects');
const { projectNamePrompt } = require('../../../lib/prompts/projectNamePrompt');
const { buildIdPrompt } = require('../../../lib/prompts/buildIdPrompt');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const yargs = require('yargs');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');
const { AxiosError, HttpStatusCode } = require('axios');

const chalk = require('chalk');

describe('commands/project/deploy', () => {
  const projectFlag = 'project';
  const buildFlag = 'buildId';
  const buildAliases = ['build'];

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(deployDescribe).toContain('[BETA]');
    });
    it('should provide an accurate description of what the command is doing', () => {
      expect(deployDescribe).toMatch(/Deploy a project build/);
    });
  });

  describe('command', () => {
    it('should the correct command structure', () => {
      expect(command).toEqual('deploy');
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
      deployedBuildId: 1,
    };
    const deployDetails = {
      id: 123,
    };
    const projectDetailUrl = 'http://project-details-page-url.com';
    const viewProjectsInHubSpot = 'View projects builds in HubSpot';

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
      getProjectDetailUrl.mockReturnValue(projectDetailUrl);
      uiLink.mockImplementation(text => {
        return text;
      });
      getAccountId.mockReturnValue(accountId);
      getAccountConfig.mockReturnValue({ accountType });
      fetchProject.mockResolvedValue(projectDetails);
      deployProject.mockResolvedValue(deployDetails);
      buildIdPrompt.mockResolvedValue({
        buildId: projectDetails.latestBuild.buildId,
      });

      // Spy on process.exit so our tests don't close when it's called
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
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
      await handler(options);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Deploy error: no builds for this project were found.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when buildId option is not a valid build', async () => {
      options.buildId = projectDetails.latestBuild.buildId + 1;
      await handler(options);
      expect(uiLink).toHaveBeenCalledTimes(1);
      expect(uiLink).toHaveBeenCalledWith(
        viewProjectsInHubSpot,
        projectDetailUrl
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Build ${options.buildId} does not exist for project ${options.project}. ${viewProjectsInHubSpot}`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when buildId option is already deployed', async () => {
      options.buildId = projectDetails.deployedBuildId;
      await handler(options);
      expect(uiLink).toHaveBeenCalledTimes(1);
      expect(uiLink).toHaveBeenCalledWith(
        viewProjectsInHubSpot,
        projectDetailUrl
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Build ${options.buildId} is already deployed. ${viewProjectsInHubSpot}`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt for build id if no option is provided', async () => {
      delete options.buildId;
      await handler(options);
      expect(buildIdPrompt).toHaveBeenCalledTimes(1);
      expect(buildIdPrompt).toHaveBeenCalledWith(
        projectDetails.latestBuild.buildId,
        projectDetails.deployedBuildId,
        options.project,
        expect.any(Function)
      );
    });

    it('should log an error and exit if the prompted value is invalid', async () => {
      delete options.buildId;
      buildIdPrompt.mockReturnValue({});

      await handler(options);

      expect(buildIdPrompt).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'You must specify a build to deploy'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
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

    it('should log an error and exit when the deploy fails', async () => {
      const errorMessage = `Just wasn't feeling it`;
      deployProject.mockResolvedValue({
        error: { message: errorMessage },
      });

      await handler(options);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Deploy error: ${errorMessage}`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
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

    it('log an error and exit if a 404 status is returned', async () => {
      const commandReference = 'hs project upload';
      const accountDescription = 'SuperCoolTestAccount';
      uiCommandReference.mockReturnValue(commandReference);
      uiAccountDescription.mockReturnValue(accountDescription);
      fetchProject.mockImplementation(() => {
        throw new AxiosError(
          'OH NO',
          '',
          {},
          {},
          { status: HttpStatusCode.NotFound }
        );
      });
      await handler(options);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `The project ${chalk.bold(
          options.project
        )} does not exist in account ${accountDescription}. Run ${commandReference} to upload your project files to HubSpot.`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('log an error and exit if a 400 status is returned', async () => {
      const commandReference = 'hs project upload';
      const accountDescription = 'SuperCoolTestAccount';
      uiCommandReference.mockReturnValue(commandReference);
      uiAccountDescription.mockReturnValue(accountDescription);
      const errorMessage = 'Something bad happened';
      fetchProject.mockImplementation(() => {
        throw new AxiosError(
          errorMessage,
          '',
          {},
          {},
          { status: HttpStatusCode.BadRequest }
        );
      });
      await handler(options);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(errorMessage);
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('log an error another unexpected status code is returned', async () => {
      const commandReference = 'hs project upload';
      const accountDescription = 'SuperCoolTestAccount';
      uiCommandReference.mockReturnValue(commandReference);
      uiAccountDescription.mockReturnValue(accountDescription);
      const errorMessage = 'Something bad happened';
      fetchProject.mockImplementation(() => {
        throw new AxiosError(
          errorMessage,
          '',
          {},
          {},
          { status: HttpStatusCode.MethodNotAllowed }
        );
      });
      await handler(options);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `The request in account ${accountId} failed due to a client error.`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
