import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { addUseEnvironmentOptions } from '../../../lib/commonOpts.js';
import { ProjectLogsManager } from '../../../lib/projects/ProjectLogsManager.js';
import * as projectLogsPrompt from '../../../lib/prompts/projectsLogsPrompt.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import * as ui from '../../../lib/ui/index.js';
import * as render from '../../../ui/render.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import projectLogsCommand, { ProjectLogsArgs } from '../logs.js';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/validation');
vi.mock('../../../lib/projects/ProjectLogsManager');
vi.mock('../../../lib/prompts/projectsLogsPrompt');
vi.mock('../../../ui/render.js');
vi.mock('../../../lib/errorHandlers');
vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getConfigAccountEnvironment: vi.fn(),
  };
});

const uiLinkSpy = vi.spyOn(ui, 'uiLink');
const uiLineSpy = vi.spyOn(ui, 'uiLine');
const processExitSpy = vi.spyOn(process, 'exit');
const projectLogsPromptSpy = vi.spyOn(projectLogsPrompt, 'projectLogsPrompt');
const projectLogsManagerSetFunctionSpy = vi.spyOn(
  ProjectLogsManager,
  'setFunction'
);
const projectLogsManagerGetFunctionNamesSpy = vi.spyOn(
  ProjectLogsManager,
  'getFunctionNames'
);
const projectLogsManagerInitSpy = vi.spyOn(ProjectLogsManager, 'init');

const renderTableSpy = vi.spyOn(render, 'renderTable');

const getConfigAccountEnvironmentMock = vi.mocked(getConfigAccountEnvironment);

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const conflictsSpy = vi
  .spyOn(yargs as Argv, 'conflicts')
  .mockReturnValue(yargs as Argv);

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

getConfigAccountEnvironmentMock.mockReturnValue(ENVIRONMENTS.PROD);

describe('commands/project/logs', () => {
  beforeEach(() => {
    // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
    processExitSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', async () => {
      expect(projectLogsCommand.command).toEqual('logs');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectLogsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectLogsCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        function: expect.objectContaining({
          alias: 'function',
          requiresArg: true,
          type: 'string',
        }),
        latest: expect.objectContaining({
          alias: 'l',
          type: 'boolean',
        }),
        compact: expect.objectContaining({
          type: 'boolean',
        }),
        tail: expect.objectContaining({
          alias: ['t', 'follow'],
          type: 'boolean',
        }),
        limit: expect.objectContaining({
          type: 'number',
        }),
      });

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should set the correct conflicts', () => {
      projectLogsCommand.builder(yargs as Argv);

      expect(conflictsSpy).toHaveBeenCalledTimes(1);
      expect(conflictsSpy).toHaveBeenCalledWith('tail', 'limit');
    });

    it('should provide examples', () => {
      projectLogsCommand.builder(yargs as Argv);

      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    let options: ArgumentsCamelCase<ProjectLogsArgs>;

    beforeEach(() => {
      options = {
        derivedAccountId: 12345678,
      } as ArgumentsCamelCase<ProjectLogsArgs>;

      projectLogsPromptSpy.mockResolvedValue({ functionName: 'foo' });
    });

    it('should track the command usage', async () => {
      await projectLogsCommand.handler(options);

      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-logs',
        undefined,
        options.derivedAccountId
      );
    });

    it('should initialize the ProjectLogsManager', async () => {
      await projectLogsCommand.handler(options);

      expect(projectLogsManagerInitSpy).toHaveBeenCalledTimes(1);
      expect(projectLogsManagerInitSpy).toHaveBeenCalledWith(
        options.derivedAccountId
      );
    });

    it('should prompt the user for input', async () => {
      const functionNames = ['function1', 'function2'];
      projectLogsManagerGetFunctionNamesSpy.mockReturnValue(functionNames);
      await projectLogsCommand.handler(options);

      expect(projectLogsPromptSpy).toHaveBeenCalledTimes(1);
      expect(projectLogsPromptSpy).toHaveBeenCalledWith({
        functionChoices: functionNames,
        promptOptions: options,
      });
    });

    it('should set the function', async () => {
      const selectedFunction = 'function1';
      projectLogsManagerGetFunctionNamesSpy.mockReturnValue([
        selectedFunction,
        'function2',
      ]);
      projectLogsPromptSpy.mockResolvedValue({
        functionName: selectedFunction,
      });

      await projectLogsCommand.handler(options);
      expect(projectLogsManagerSetFunctionSpy).toHaveBeenCalledTimes(1);
      expect(projectLogsManagerSetFunctionSpy).toHaveBeenCalledWith(
        selectedFunction
      );
    });

    it('should log public functions correctly', async () => {
      const functionNames = ['function1', 'function2'];
      const selectedFunction = 'function1';
      projectLogsManagerGetFunctionNamesSpy.mockReturnValue(functionNames);
      projectLogsPromptSpy.mockResolvedValue({
        functionName: selectedFunction,
      });

      ProjectLogsManager.isPublicFunction = true;
      ProjectLogsManager.accountId = options.derivedAccountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.endpointName = 'my-endpoint';
      ProjectLogsManager.appId = 123456;

      await projectLogsCommand.handler(options);

      expect(renderTableSpy).toHaveBeenCalledTimes(1);
      expect(renderTableSpy).toHaveBeenCalledWith(
        ['Account', 'Function', 'Endpoint'],
        [
          [
            String(ProjectLogsManager.accountId),
            ProjectLogsManager.functionName,
            ProjectLogsManager.endpointName,
          ],
        ]
      );
      expect(uiLinkSpy).toHaveBeenCalledTimes(1);
      expect(uiLinkSpy).toHaveBeenCalledWith(
        'View function logs in HubSpot',
        `https://app.hubspot.com/private-apps/${options.derivedAccountId}/${ProjectLogsManager.appId}/logs/serverlessGatewayExecution?path=${ProjectLogsManager.endpointName}`
      );
      expect(uiLineSpy).toHaveBeenCalledTimes(1);
    });

    it('should log private functions correctly', async () => {
      const functionNames = ['function1', 'function2'];
      const selectedFunction = 'function1';

      projectLogsManagerGetFunctionNamesSpy.mockReturnValue(functionNames);
      projectLogsPromptSpy.mockResolvedValue({
        functionName: selectedFunction,
      });

      ProjectLogsManager.isPublicFunction = false;
      ProjectLogsManager.accountId = options.derivedAccountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.appId = 456789;

      await projectLogsCommand.handler(options);

      expect(renderTableSpy).toHaveBeenCalledTimes(1);

      expect(renderTableSpy).toHaveBeenCalledWith(
        ['Account', 'Function'],
        [
          [
            String(ProjectLogsManager.accountId),
            ProjectLogsManager.functionName,
          ],
        ]
      );

      expect(uiLinkSpy).toHaveBeenCalledWith(
        'View function logs in HubSpot',
        `https://app.hubspot.com/private-apps/${options.derivedAccountId}/${ProjectLogsManager.appId}/logs/crm?serverlessFunction=${selectedFunction}`
      );

      expect(uiLineSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Something went wrong');
      projectLogsManagerInitSpy.mockImplementation(() => {
        throw error;
      });

      ProjectLogsManager.projectName = 'Super cool project';
      await projectLogsCommand.handler(options);

      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(error, {
        accountId: options.derivedAccountId,
        projectName: ProjectLogsManager.projectName,
      });

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
