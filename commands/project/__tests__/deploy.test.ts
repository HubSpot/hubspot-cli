// @ts-nocheck
const { AxiosError, HttpStatusCode } = require('axios');
const yargs = require('yargs');
const chalk = require('chalk');
const {
  HubSpotHttpError,
} = require('@hubspot/local-dev-lib/models/HubSpotHttpError');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  deployProject,
  fetchProject,
} = require('@hubspot/local-dev-lib/api/projects');
const ui = require('../../../lib/ui');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../../lib/commonOpts');
const { getProjectConfig } = require('../../../lib/projects');
const { getProjectDetailUrl } = require('../../../lib/projects/urls');
const { pollDeployStatus } = require('../../../lib/projects/buildAndDeploy');
const { projectNamePrompt } = require('../../../lib/prompts/projectNamePrompt');
const { promptUser } = require('../../../lib/prompts/promptUtils');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('../../../lib/commonOpts');
jest.mock('../../../lib/validation');
jest.mock('../../../lib/projects');
jest.mock('../../../lib/projects/urls');
jest.mock('../../../lib/projects/buildAndDeploy');
jest.mock('../../../lib/prompts/projectNamePrompt');
jest.mock('../../../lib/prompts/promptUtils');
jest.mock('../../../lib/usageTracking');
jest.spyOn(ui, 'uiLine');
const uiLinkSpy = jest.spyOn(ui, 'uiLink').mockImplementation(text => text);
const uiCommandReferenceSpy = jest.spyOn(ui, 'uiCommandReference');
const uiAccountDescriptionSpy = jest.spyOn(ui, 'uiAccountDescription');

// Import this last so mocks apply
const deployCommand = require('../deploy');

describe('commands/project/deploy', () => {
  const projectFlag = 'project';
  const buildFlag = 'build';
  const buildAliases = ['build-id'];
  const useV3Flag = 'use-v3';

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(deployCommand.command).toEqual('deploy');
    });
  });

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(deployCommand.describe).toContain('[BETA]');
    });

    it('should provide a description', () => {
      expect(deployCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      deployCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        [projectFlag]: expect.objectContaining({ type: 'string' }),
        [buildFlag]: expect.objectContaining({
          alias: buildAliases,
          type: 'number',
        }),
        [useV3Flag]: expect.objectContaining({
          type: 'boolean',
          hidden: true,
          default: false,
        }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should provide examples', () => {
      deployCommand.builder(yargs);

      expect(yargs.example).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    let projectConfig;
    let processExitSpy;
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
    const viewProjectsInHubSpot = 'View project builds in HubSpot';

    beforeEach(() => {
      options = {
        project: 'project name from options',
        buildId: 2,
        derivedAccountId: 1234567890,
      };
      projectConfig = {
        name: 'project name from config',
      };
      getProjectConfig.mockResolvedValue({ projectConfig });
      projectNamePrompt.mockResolvedValue({ projectName: 'fooo' });
      getProjectDetailUrl.mockReturnValue(projectDetailUrl);
      uiLinkSpy.mockImplementation(text => {
        return text;
      });
      getAccountConfig.mockReturnValue({ accountType });
      fetchProject.mockResolvedValue({ data: projectDetails });
      deployProject.mockResolvedValue({ data: deployDetails });

      // Spy on process.exit so our tests don't close when it's called
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    it('should load the account config for the correct account id', async () => {
      await deployCommand.handler(options);
      expect(getAccountConfig).toHaveBeenCalledTimes(1);
      expect(getAccountConfig).toHaveBeenCalledWith(options.derivedAccountId);
    });

    it('should track the command usage', async () => {
      await deployCommand.handler(options);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-deploy',
        { type: accountType },
        options.derivedAccountId
      );
    });

    it('should load the project config', async () => {
      await deployCommand.handler(options);
      expect(getProjectConfig).toHaveBeenCalledTimes(1);
      expect(getProjectConfig).toHaveBeenCalledWith();
    });

    it('should load the project config', async () => {
      await deployCommand.handler(options);
      expect(getProjectConfig).toHaveBeenCalledTimes(1);
      expect(getProjectConfig).toHaveBeenCalledWith();
    });

    it('should prompt for the project name', async () => {
      await deployCommand.handler(options);
      expect(projectNamePrompt).toHaveBeenCalledTimes(1);
      expect(projectNamePrompt).toHaveBeenCalledWith(options.derivedAccountId, {
        project: options.project,
      });
    });

    it('should use the project name from the config is a project options is not provided', async () => {
      delete options.project;
      await deployCommand.handler(options);
      expect(projectNamePrompt).toHaveBeenCalledTimes(1);
      expect(projectNamePrompt).toHaveBeenCalledWith(options.derivedAccountId, {
        project: projectConfig.name,
      });
    });

    it('should fetch the project details', async () => {
      await deployCommand.handler(options);
      expect(fetchProject).toHaveBeenCalledTimes(1);
      expect(fetchProject).toHaveBeenCalledWith(
        options.derivedAccountId,
        options.project
      );
    });

    it('should use the name from the prompt if no others are defined', async () => {
      delete options.project;
      const promptProjectName = 'project name from the prompt';
      projectNamePrompt.mockReturnValue({ projectName: promptProjectName });
      getProjectConfig.mockResolvedValue({});

      await deployCommand.handler(options);

      expect(projectNamePrompt).toHaveBeenCalledTimes(1);
      expect(projectNamePrompt).toHaveBeenCalledWith(
        options.derivedAccountId,
        {}
      );
      expect(fetchProject).toHaveBeenCalledTimes(1);
      expect(fetchProject).toHaveBeenCalledWith(
        options.derivedAccountId,
        promptProjectName
      );
    });

    it('should log an error and exit when latest build is not defined', async () => {
      fetchProject.mockResolvedValue({ data: {} });
      await deployCommand.handler(options);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Deploy error: no builds for this project were found.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when buildId option is not a valid build', async () => {
      options.buildId = projectDetails.latestBuild.buildId + 1;
      await deployCommand.handler(options);
      expect(uiLinkSpy).toHaveBeenCalledTimes(1);
      expect(uiLinkSpy).toHaveBeenCalledWith(
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
      await deployCommand.handler(options);
      expect(uiLinkSpy).toHaveBeenCalledTimes(1);
      expect(uiLinkSpy).toHaveBeenCalledWith(
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
      promptUser.mockResolvedValue({
        buildId: projectDetails.latestBuild.buildId,
      });
      await deployCommand.handler(options);
      expect(promptUser).toHaveBeenCalledTimes(1);
    });

    it('should log an error and exit if the prompted value is invalid', async () => {
      delete options.buildId;
      promptUser.mockResolvedValue({});
      await deployCommand.handler(options);

      expect(promptUser).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'You must specify a build to deploy'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should deploy the project', async () => {
      await deployCommand.handler(options);
      expect(deployProject).toHaveBeenCalledTimes(1);
      expect(deployProject).toHaveBeenCalledWith(
        options.derivedAccountId,
        options.project,
        options.buildId,
        undefined
      );
    });

    it('should log an error and exit when the deploy fails', async () => {
      const errorMessage = `Just wasn't feeling it`;
      deployProject.mockResolvedValue({
        data: {
          error: { message: errorMessage },
        },
      });

      await deployCommand.handler(options);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Deploy error: ${errorMessage}`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should poll the deploy status', async () => {
      await deployCommand.handler(options);
      expect(pollDeployStatus).toHaveBeenCalledTimes(1);
      expect(pollDeployStatus).toHaveBeenCalledWith(
        options.derivedAccountId,
        options.project,
        deployDetails.id,
        options.buildId
      );
    });

    it('log an error and exit if a 404 status is returned', async () => {
      const commandReference = 'hs project upload';
      const accountDescription = 'SuperCoolTestAccount';
      uiCommandReferenceSpy.mockReturnValueOnce(commandReference);
      uiAccountDescriptionSpy.mockReturnValueOnce(accountDescription);
      fetchProject.mockImplementation(() => {
        throw new HubSpotHttpError('OH NO', {
          cause: new AxiosError(
            'OH NO',
            '',
            {},
            {},
            { status: HttpStatusCode.NotFound }
          ),
        });
      });
      await deployCommand.handler(options);

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
      const errorMessage = 'Something bad happened';
      fetchProject.mockImplementation(() => {
        throw new HubSpotHttpError(errorMessage, {
          cause: new AxiosError(
            errorMessage,
            '',
            {},
            {},
            { status: HttpStatusCode.BadRequest }
          ),
        });
      });
      await deployCommand.handler(options);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('The request was bad.');
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('log an error another unexpected status code is returned', async () => {
      const errorMessage = 'Something bad happened';
      fetchProject.mockImplementation(() => {
        throw new HubSpotHttpError('OH NO', {
          cause: new AxiosError(
            errorMessage,
            '',
            {},
            {},
            { status: HttpStatusCode.MethodNotAllowed }
          ),
        });
      });
      await deployCommand.handler(options);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `The request for 'project deploy' in account ${options.derivedAccountId} failed due to a client error.`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
