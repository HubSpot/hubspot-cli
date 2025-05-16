import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import * as configUtils from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import * as projectApiUtils from '@hubspot/local-dev-lib/api/projects';
import * as ui from '../../../lib/ui';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import * as projectUtils from '../../../lib/projects/config';
import * as projectUrlUtils from '../../../lib/projects/urls';
import { pollDeployStatus } from '../../../lib/projects/buildAndDeploy';
import * as projectNamePrompt from '../../../lib/prompts/projectNamePrompt';
import * as promptUtils from '../../../lib/prompts/promptUtils';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { ProjectConfig } from '../../../types/Projects';
import exampleProject from './fixtures/exampleProject.json';
import {
  mockHubSpotHttpResponse,
  mockHubSpotHttpError,
} from '../../../lib/testUtils';
import projectDeployCommand, { ProjectDeployArgs } from '../deploy';

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('../../../lib/commonOpts');
jest.mock('../../../lib/validation');
jest.mock('../../../lib/projects/config');
jest.mock('../../../lib/projects/urls');
jest.mock('../../../lib/projects/buildAndDeploy');
jest.mock('../../../lib/prompts/projectNamePrompt');
jest.mock('../../../lib/prompts/promptUtils');
jest.mock('../../../lib/usageTracking');

jest.spyOn(ui, 'uiLine');

const uiLinkSpy = jest.spyOn(ui, 'uiLink').mockImplementation(text => text);
const uiCommandReferenceSpy = jest.spyOn(ui, 'uiCommandReference');
const uiAccountDescriptionSpy = jest.spyOn(ui, 'uiAccountDescription');
const getProjectConfigSpy = jest.spyOn(projectUtils, 'getProjectConfig');
const projectNamePromptSpy = jest.spyOn(projectNamePrompt, 'projectNamePrompt');
const getProjectDetailUrlSpy = jest.spyOn(
  projectUrlUtils,
  'getProjectDetailUrl'
);
const fetchProjectSpy = jest.spyOn(projectApiUtils, 'fetchProject');
const deployProjectSpy = jest.spyOn(projectApiUtils, 'deployProject');
const getAccountConfigSpy = jest.spyOn(configUtils, 'getAccountConfig');
const promptUserSpy = jest.spyOn(promptUtils, 'promptUser');
const processExitSpy = jest.spyOn(process, 'exit');

const optionsSpy = jest
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const conflictsSpy = jest
  .spyOn(yargs as Argv, 'conflicts')
  .mockReturnValue(yargs as Argv);

describe('commands/project/deploy', () => {
  const projectFlag = 'project';
  const buildFlag = 'build';
  const buildAliases = ['build-id'];
  const profileFlag = 'profile';

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectDeployCommand.command).toEqual('deploy');
    });
  });

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(projectDeployCommand.describe).toContain('[BETA]');
    });

    it('should provide a description', () => {
      expect(projectDeployCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectDeployCommand.builder(yargs as Argv);

      expect(conflictsSpy).toHaveBeenCalledTimes(2);
      expect(conflictsSpy).toHaveBeenNthCalledWith(1, profileFlag, projectFlag);
      expect(conflictsSpy).toHaveBeenNthCalledWith(2, profileFlag, 'account');

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        [projectFlag]: expect.objectContaining({ type: 'string' }),
        [buildFlag]: expect.objectContaining({
          alias: buildAliases,
          type: 'number',
        }),
        [profileFlag]: expect.objectContaining({
          type: 'string',
          alias: ['p'],
          hidden: true,
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
      projectDeployCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    let projectConfig: ProjectConfig;
    const accountType = 'STANDARD';
    let args: ArgumentsCamelCase<ProjectDeployArgs>;
    const projectNameFromPrompt = 'project name from prompt';
    const deployDetails = {
      id: 123,
    };
    const projectDetailUrl = 'http://project-details-page-url.com';
    const viewProjectsInHubSpot = 'View project builds in HubSpot';

    beforeEach(() => {
      args = {
        project: 'project name from options',
        buildId: 2,
        derivedAccountId: 1234567890,
      } as ArgumentsCamelCase<ProjectDeployArgs>;
      projectConfig = {
        name: 'project name from config',
        srcDir: 'src',
        platformVersion: '2025',
      };
      getProjectConfigSpy.mockResolvedValue({
        projectConfig,
        projectDir: 'projectDir',
      });
      projectNamePromptSpy.mockResolvedValue({
        projectName: projectNameFromPrompt,
      });
      getProjectDetailUrlSpy.mockReturnValue(projectDetailUrl);
      uiLinkSpy.mockImplementation(text => {
        return text;
      });
      getAccountConfigSpy.mockReturnValue({ accountType, env: 'qa' });
      fetchProjectSpy.mockResolvedValue(
        mockHubSpotHttpResponse(exampleProject)
      );
      deployProjectSpy.mockResolvedValue(
        mockHubSpotHttpResponse(deployDetails)
      );

      // Spy on process.exit so our tests don't close when it's called
      // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
      processExitSpy.mockImplementation(() => {});
    });

    it('should load the account config for the correct account id', async () => {
      await projectDeployCommand.handler(args);
      expect(getAccountConfigSpy).toHaveBeenCalledTimes(1);
      expect(getAccountConfigSpy).toHaveBeenCalledWith(args.derivedAccountId);
    });

    it('should track the command usage', async () => {
      await projectDeployCommand.handler(args);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-deploy',
        { type: accountType },
        args.derivedAccountId
      );
    });

    it('should load the project config', async () => {
      await projectDeployCommand.handler(args);
      expect(getProjectConfigSpy).toHaveBeenCalledTimes(1);
      expect(getProjectConfigSpy).toHaveBeenCalled();
    });

    it('should prompt for the project name', async () => {
      await projectDeployCommand.handler(args);
      expect(projectNamePromptSpy).toHaveBeenCalledTimes(1);
      expect(projectNamePromptSpy).toHaveBeenCalledWith(args.derivedAccountId, {
        project: args.project,
      });
    });

    it('should use the project name from the config is a project args is not provided', async () => {
      delete args.project;
      await projectDeployCommand.handler(args);
      expect(projectNamePromptSpy).toHaveBeenCalledTimes(1);
      expect(projectNamePromptSpy).toHaveBeenCalledWith(args.derivedAccountId, {
        project: projectConfig.name,
      });
    });

    it('should fetch the project details', async () => {
      await projectDeployCommand.handler(args);
      expect(fetchProjectSpy).toHaveBeenCalledTimes(1);
      expect(fetchProjectSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        projectNameFromPrompt
      );
    });

    it('should use the name from the prompt if no others are defined', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { project: __project, ...argsWithoutProject } = args;

      const promptProjectName = 'project name from the prompt';
      projectNamePromptSpy.mockResolvedValue({
        projectName: promptProjectName,
      });
      getProjectConfigSpy.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await projectDeployCommand.handler(argsWithoutProject);

      expect(projectNamePromptSpy).toHaveBeenCalledTimes(1);
      expect(projectNamePromptSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        {}
      );
      expect(fetchProjectSpy).toHaveBeenCalledTimes(1);
      expect(fetchProjectSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        promptProjectName
      );
    });

    it('should log an error and exit when latest build is not defined', async () => {
      fetchProjectSpy.mockResolvedValue(mockHubSpotHttpResponse({}));
      await projectDeployCommand.handler(args);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Deploy error: no builds for this project were found.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when buildId option is not a valid build', async () => {
      args.buildId = exampleProject.latestBuild.buildId + 1;
      await projectDeployCommand.handler(args);
      expect(uiLinkSpy).toHaveBeenCalledTimes(1);
      expect(uiLinkSpy).toHaveBeenCalledWith(
        viewProjectsInHubSpot,
        projectDetailUrl
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Build ${args.buildId} does not exist for project ${projectNameFromPrompt}. ${viewProjectsInHubSpot}`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when buildId option is already deployed', async () => {
      args.buildId = exampleProject.deployedBuildId;
      await projectDeployCommand.handler(args);
      expect(uiLinkSpy).toHaveBeenCalledTimes(1);
      expect(uiLinkSpy).toHaveBeenCalledWith(
        viewProjectsInHubSpot,
        projectDetailUrl
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Build ${args.buildId} is already deployed. ${viewProjectsInHubSpot}`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt for build id if no option is provided', async () => {
      delete args.buildId;
      promptUserSpy.mockResolvedValue({
        buildId: exampleProject.latestBuild.buildId,
      });
      await projectDeployCommand.handler(args);
      expect(promptUserSpy).toHaveBeenCalledTimes(1);
    });

    it('should log an error and exit if the prompted value is invalid', async () => {
      delete args.buildId;
      promptUserSpy.mockResolvedValue({});
      await projectDeployCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'You must specify a build to deploy'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should deploy the project', async () => {
      await projectDeployCommand.handler(args);
      expect(deployProjectSpy).toHaveBeenCalledTimes(1);
      expect(deployProjectSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        projectNameFromPrompt,
        args.buildId,
        undefined
      );
    });

    it('should log an error and exit when the deploy fails', async () => {
      // @ts-expect-error Testing an edge case where the response is empty
      deployProjectSpy.mockResolvedValue({});

      await projectDeployCommand.handler(args);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `Deploy error: an unknown error occurred.`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should poll the deploy status', async () => {
      await projectDeployCommand.handler(args);
      expect(pollDeployStatus).toHaveBeenCalledTimes(1);
      expect(pollDeployStatus).toHaveBeenCalledWith(
        args.derivedAccountId,
        projectNameFromPrompt,
        deployDetails.id,
        args.buildId
      );
    });

    it('log an error and exit if a 404 status is returned', async () => {
      const commandReference = 'hs project upload';
      const accountDescription = 'SuperCoolTestAccount';
      uiCommandReferenceSpy.mockReturnValueOnce(commandReference);
      uiAccountDescriptionSpy.mockReturnValueOnce(accountDescription);
      fetchProjectSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('OH NO', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });
      await projectDeployCommand.handler(args);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `The project ${chalk.bold(
          projectNameFromPrompt
        )} does not exist in account ${accountDescription}. Run ${commandReference} to upload your project files to HubSpot.`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('log an error and exit if a 400 status is returned', async () => {
      const errorMessage = 'Something bad happened';
      fetchProjectSpy.mockImplementation(() => {
        throw mockHubSpotHttpError(errorMessage, {
          status: HttpStatusCode.BadRequest,
          data: {},
        });
      });
      await projectDeployCommand.handler(args);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('The request was bad.');
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('log an error another unexpected status code is returned', async () => {
      const errorMessage = 'Something bad happened';
      fetchProjectSpy.mockImplementation(() => {
        throw mockHubSpotHttpError(errorMessage, {
          status: HttpStatusCode.MethodNotAllowed,
          data: {},
        });
      });
      await projectDeployCommand.handler(args);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        `The request for 'project deploy' in account ${args.derivedAccountId} failed due to a client error.`
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
