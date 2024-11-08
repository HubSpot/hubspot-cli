// @ts-nocheck
const yargs = require('yargs');
const { addUseEnvironmentOptions } = require('../../../lib/commonOpts');
const ProjectLogsManager = require('../../../lib/projectLogsManager');
const {
  projectLogsPrompt,
} = require('../../../lib/prompts/projectsLogsPrompt');
const { getTableContents, getTableHeader } = require('../../../lib/ui/table');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const ui = require('../../../lib/ui');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');
const { logError } = require('../../../lib/errorHandlers');

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/commonOpts');
jest.mock('../../../lib/usageTracking');
jest.mock('../../../lib/validation');
jest.mock('../../../lib/ProjectLogsManager');
jest.mock('../../../lib/prompts/projectsLogsPrompt');
jest.mock('../../../lib/ui/table');
jest.mock('../../../lib/errorHandlers');

yargs.options.mockReturnValue(yargs);
yargs.conflicts.mockReturnValue(yargs);
const uiLinkSpy = jest.spyOn(ui, 'uiLink');
const uiLineSpy = jest.spyOn(ui, 'uiLine');

// Import this last so mocks apply
const logsCommand = require('../logs');

describe('commands/project/logs', () => {
  let processExitSpy;

  beforeEach(() => {
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', async () => {
      expect(logsCommand.command).toEqual('logs');
    });
  });

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(logsCommand.describe).toContain('[BETA]');
    });

    it('should provide a description', () => {
      expect(logsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      logsCommand.builder(yargs);
      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
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

    it('should set tail and limit as conflicting arguments', () => {
      logsCommand.builder(yargs);
      expect(yargs.conflicts).toHaveBeenCalledTimes(1);
      expect(yargs.conflicts).toHaveBeenCalledWith('tail', 'limit');
    });

    it('should provide examples', () => {
      logsCommand.builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      projectLogsPrompt.mockResolvedValue({ functionName: 'foo' });
    });

    it('should track the command usage', async () => {
      const options = {
        foo: 'bar',
        derivedAccountId: 12345678,
      };
      await logsCommand.handler(options);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-logs',
        null,
        options.derivedAccountId
      );
    });

    it('should initialize the ProjectLogsManager', async () => {
      const options = {
        foo: 'bar',
        derivedAccountId: 12345678,
      };
      await logsCommand.handler(options);
      expect(ProjectLogsManager.init).toHaveBeenCalledTimes(1);
      expect(ProjectLogsManager.init).toHaveBeenCalledWith(
        options.derivedAccountId
      );
    });

    it('should prompt the user for input', async () => {
      const functionNames = ['function1', 'function2'];
      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      const options = {
        foo: 'bar',
      };
      await logsCommand.handler(options);
      expect(projectLogsPrompt).toHaveBeenCalledTimes(1);
      expect(projectLogsPrompt).toHaveBeenCalledWith({
        functionChoices: functionNames,
        promptOptions: options,
      });
    });

    it('should set the function', async () => {
      const selectedFunction = 'function1';
      ProjectLogsManager.getFunctionNames.mockReturnValue([
        selectedFunction,
        'function2',
      ]);
      projectLogsPrompt.mockReturnValue({
        functionName: selectedFunction,
      });

      await logsCommand.handler({});
      expect(ProjectLogsManager.setFunction).toHaveBeenCalledTimes(1);
      expect(ProjectLogsManager.setFunction).toHaveBeenCalledWith(
        selectedFunction
      );
    });

    it('should log public functions correctly', async () => {
      const options = {
        derivedAccountId: 12345678,
      };
      const functionNames = ['function1', 'function2'];
      const selectedFunction = 'function1';
      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      projectLogsPrompt.mockReturnValue({
        functionName: selectedFunction,
      });

      const tableHeaders = ['Header 1', 'Header 2'];
      getTableHeader.mockReturnValue(tableHeaders);

      ProjectLogsManager.isPublicFunction = true;
      ProjectLogsManager.accountId = options.derivedAccountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.endpointName = 'my-endpoint';
      ProjectLogsManager.appId = 123456;

      await logsCommand.handler(options);

      expect(getTableHeader).toHaveBeenCalledTimes(1);
      expect(getTableHeader).toHaveBeenCalledWith([
        'Account',
        'Function',
        'Endpoint',
      ]);

      expect(getTableContents).toHaveBeenCalledTimes(1);
      expect(getTableContents).toHaveBeenCalledWith(
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
      const options = {
        derivedAccountId: 12345678,
      };

      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      projectLogsPrompt.mockReturnValue({
        functionName: selectedFunction,
      });

      const tableHeaders = ['Header 1', 'Header 2'];
      getTableHeader.mockReturnValue(tableHeaders);

      ProjectLogsManager.isPublicFunction = false;
      ProjectLogsManager.accountId = options.derivedAccountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.appId = 456789;

      await logsCommand.handler(options);

      expect(getTableHeader).toHaveBeenCalledTimes(1);
      expect(getTableHeader).toHaveBeenCalledWith(['Account', 'Function']);

      expect(getTableContents).toHaveBeenCalledTimes(1);
      expect(getTableContents).toHaveBeenCalledWith(
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
      const options = {
        derivedAccountId: 12345678,
      };
      const error = new Error('Something went wrong');
      ProjectLogsManager.init.mockImplementation(() => {
        throw error;
      });

      ProjectLogsManager.projectName = 'Super cool project';
      await logsCommand.handler(options);

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
