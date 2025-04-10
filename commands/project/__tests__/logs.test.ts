import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { addUseEnvironmentOptions } from '../../../lib/commonOpts';
import { ProjectLogsManager } from '../../../lib/projects/ProjectLogsManager';
import * as projectLogsPrompt from '../../../lib/prompts/projectsLogsPrompt';
import * as table from '../../../lib/ui/table';
import { trackCommandUsage } from '../../../lib/usageTracking';
import * as ui from '../../../lib/ui';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { logError } from '../../../lib/errorHandlers';
import * as projectLogsCommand from '../logs';

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/commonOpts');
jest.mock('../../../lib/usageTracking');
jest.mock('../../../lib/validation');
jest.mock('../../../lib/projects/ProjectLogsManager');
jest.mock('../../../lib/prompts/projectsLogsPrompt');
jest.mock('../../../lib/ui/table');
jest.mock('../../../lib/errorHandlers');

const uiLinkSpy = jest.spyOn(ui, 'uiLink');
const uiLineSpy = jest.spyOn(ui, 'uiLine');
const processExitSpy = jest.spyOn(process, 'exit');
const projectLogsPromptSpy = jest.spyOn(projectLogsPrompt, 'projectLogsPrompt');
const projectLogsManagerSetFunctionSpy = jest.spyOn(
  ProjectLogsManager,
  'setFunction'
);
const projectLogsManagerGetFunctionNamesSpy = jest.spyOn(
  ProjectLogsManager,
  'getFunctionNames'
);
const projectLogsManagerInitSpy = jest.spyOn(ProjectLogsManager, 'init');

const getTableHeaderSpy = jest.spyOn(table, 'getTableHeader');
const getTableContentsSpy = jest.spyOn(table, 'getTableContents');

const optionsSpy = jest
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const conflictsSpy = jest
  .spyOn(yargs as Argv, 'conflicts')
  .mockReturnValue(yargs as Argv);

const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

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
    it('should contain the beta tag', () => {
      expect(projectLogsCommand.describe).toContain('[BETA]');
    });

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
    let options: ArgumentsCamelCase<projectLogsCommand.ProjectLogsArgs>;

    beforeEach(() => {
      options = {
        derivedAccountId: 12345678,
      } as ArgumentsCamelCase<projectLogsCommand.ProjectLogsArgs>;

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

      const tableHeaders = ['Header 1', 'Header 2'];
      getTableHeaderSpy.mockReturnValue(tableHeaders);

      ProjectLogsManager.isPublicFunction = true;
      ProjectLogsManager.accountId = options.derivedAccountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.endpointName = 'my-endpoint';
      ProjectLogsManager.appId = 123456;

      await projectLogsCommand.handler(options);

      expect(getTableHeaderSpy).toHaveBeenCalledTimes(1);
      expect(getTableHeaderSpy).toHaveBeenCalledWith([
        'Account',
        'Function',
        'Endpoint',
      ]);

      expect(getTableContentsSpy).toHaveBeenCalledTimes(1);
      expect(getTableContentsSpy).toHaveBeenCalledWith(
        [
          tableHeaders,
          [
            ProjectLogsManager.accountId,
            ProjectLogsManager.functionName,
            ProjectLogsManager.endpointName,
          ],
        ],
        { border: { bodyLeft: '  ' } }
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

      const tableHeaders = ['Header 1', 'Header 2'];
      getTableHeaderSpy.mockReturnValue(tableHeaders);

      ProjectLogsManager.isPublicFunction = false;
      ProjectLogsManager.accountId = options.derivedAccountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.appId = 456789;

      await projectLogsCommand.handler(options);

      expect(getTableHeaderSpy).toHaveBeenCalledTimes(1);
      expect(getTableHeaderSpy).toHaveBeenCalledWith(['Account', 'Function']);

      expect(getTableContentsSpy).toHaveBeenCalledTimes(1);
      expect(getTableContentsSpy).toHaveBeenCalledWith(
        [
          tableHeaders,
          [ProjectLogsManager.accountId, ProjectLogsManager.functionName],
        ],
        { border: { bodyLeft: '  ' } }
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
