jest.mock('../../../lib/commonOpts');
jest.mock('../../../lib/usageTracking');
jest.mock('../../../lib/validation');
jest.mock('../../../lib/projectLogsManager');
jest.mock('../../../lib/prompts/projectsLogsPrompt');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/errorHandlers/apiErrors');
jest.mock('../../../lib/ui/table');
jest.mock('../../../lib/ui');
jest.mock('../../../lib/errorHandlers/apiErrors');

// Deps where we don't want mocks
const libUi = jest.requireActual('../../../lib/ui');

const { uiLine, uiLink, uiBetaTag } = require('../../../lib/ui');

uiBetaTag.mockImplementation(libUi.uiBetaTag);

const {
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../../lib/commonOpts');
const ProjectLogsManager = require('../../../lib/projectLogsManager');
const {
  projectLogsPrompt,
} = require('../../../lib/prompts/projectsLogsPrompt');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getTableContents, getTableHeader } = require('../../../lib/ui/table');

const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logApiErrorInstance } = require('../../../lib/errorHandlers/apiErrors');

const {
  handler,
  describe: logsDescribe,
  command,
  builder,
} = require('../logs');
const { EXIT_CODES } = require('../../../lib/enums/exitCodes');

describe('commands/project/logs', () => {
  let processExitSpy;
  beforeEach(() => {
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the proper command string', async () => {
      expect(command).toEqual('logs');
    });
  });

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(logsDescribe).toContain('[BETA]');
    });
    it('should provide an accurate description of what the command is doing', () => {
      expect(logsDescribe).toMatch(
        /Get execution logs for a serverless function within a project/
      );
    });
  });

  describe('builder', () => {
    let yargsMock = {};
    beforeEach(() => {
      yargsMock = {
        options: jest.fn().mockImplementation(() => yargsMock),
        conflicts: jest.fn().mockImplementation(() => yargsMock),
        example: jest.fn().mockImplementation(() => yargsMock),
      };
    });

    it('should add all of the options', () => {
      builder(yargsMock);
      expect(yargsMock.options).toHaveBeenCalledTimes(1);
      expect(yargsMock.options).toHaveBeenCalledWith({
        function: {
          alias: 'function',
          requiresArg: true,
          describe: 'App function name',
          type: 'string',
        },
        latest: {
          alias: 'l',
          type: 'boolean',
          describe: 'Retrieve most recent log only',
        },
        compact: {
          type: 'boolean',
          describe: 'Output compact logs',
        },
        tail: {
          alias: ['t', 'follow'],
          describe: 'Tail logs',
          type: 'boolean',
        },
        limit: {
          type: 'number',
          describe: 'Limit the number of logs to output',
        },
      });
    });

    it('should add the environment options', () => {
      builder(yargsMock);
      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should set tail and limit as conflicting arguments', () => {
      builder(yargsMock);
      expect(yargsMock.conflicts).toHaveBeenCalledTimes(1);
      expect(yargsMock.conflicts).toHaveBeenCalledWith('tail', 'limit');
    });

    it('should set examples', () => {
      builder(yargsMock);
      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.example).toHaveBeenCalledWith([
        [
          '$0 project logs',
          'Open the project logs prompt to get logs for a serverless function',
        ],
        [
          '$0 project logs --function=my-function',
          'Get logs for function named "my-function" within the app named "app" within the project named "my-project"',
        ],
      ]);
    });
  });

  describe('handler', () => {
    const accountId = 12345678;

    beforeEach(() => {
      getAccountId.mockReturnValue(accountId);
      projectLogsPrompt.mockResolvedValue({ functionName: 'foo' });
    });

    it('should get the account id', async () => {
      const options = {
        foo: 'bar',
      };
      await handler(options);
      expect(getAccountId).toHaveBeenCalledTimes(1);
      expect(getAccountId).toHaveBeenCalledWith(options);
    });

    it('should track the command usage', async () => {
      const options = {
        foo: 'bar',
      };
      await handler(options);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-logs',
        null,
        accountId
      );
    });

    it('should initialize the ProjectLogsManager', async () => {
      const options = {
        foo: 'bar',
      };
      await handler(options);
      expect(ProjectLogsManager.init).toHaveBeenCalledTimes(1);
      expect(ProjectLogsManager.init).toHaveBeenCalledWith(accountId);
    });

    it('should prompt the user for input', async () => {
      const functionNames = ['function1', 'function2'];
      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      const options = {
        foo: 'bar',
      };
      await handler(options);
      expect(projectLogsPrompt).toHaveBeenCalledTimes(1);
      expect(projectLogsPrompt).toHaveBeenCalledWith({
        functionChoices: functionNames,
        promptOptions: options,
      });
    });

    it('should log an error and exit if there is a problem with the function choice', async () => {
      const functionNames = ['function1', 'function2'];
      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      projectLogsPrompt.mockReturnValue({});

      await handler({});
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Unable to determine which function was selected'
      );

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
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

      await handler({});
      expect(ProjectLogsManager.setFunction).toHaveBeenCalledTimes(1);
      expect(ProjectLogsManager.setFunction).toHaveBeenCalledWith(
        selectedFunction
      );
    });

    it('should log public functions correctly', async () => {
      const functionNames = ['function1', 'function2'];
      const selectedFunction = 'function1';
      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      projectLogsPrompt.mockReturnValue({
        functionName: selectedFunction,
      });

      const tableHeaders = ['Header 1', 'Header 2'];
      getTableHeader.mockReturnValue(tableHeaders);

      ProjectLogsManager.isPublicFunction = true;
      ProjectLogsManager.accountId = accountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.endpointName = 'my-endpoint';
      ProjectLogsManager.appId = 123456;

      await handler({});
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
      expect(uiLink).toHaveBeenCalledTimes(1);
      expect(uiLink).toHaveBeenCalledWith(
        'View logs in HubSpot',
        `https://app.hubspot.com/private-apps/${accountId}/${ProjectLogsManager.appId}/logs/serverlessGatewayExecution?path=${ProjectLogsManager.endpointName}`
      );
      expect(uiLine).toHaveBeenCalledTimes(1);
    });

    it('should log private functions correctly', async () => {
      const functionNames = ['function1', 'function2'];
      const selectedFunction = 'function1';

      ProjectLogsManager.getFunctionNames.mockReturnValue(functionNames);
      projectLogsPrompt.mockReturnValue({
        functionName: selectedFunction,
      });

      const tableHeaders = ['Header 1', 'Header 2'];
      getTableHeader.mockReturnValue(tableHeaders);

      ProjectLogsManager.isPublicFunction = false;
      ProjectLogsManager.accountId = accountId;
      ProjectLogsManager.functionName = selectedFunction;
      ProjectLogsManager.appId = 456789;

      await handler({});
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

      expect(uiLink).toHaveBeenCalledWith(
        'View logs in HubSpot',
        `https://app.hubspot.com/private-apps/${accountId}/${ProjectLogsManager.appId}/logs/crm?serverlessFunction=${selectedFunction}`
      );

      expect(uiLine).toHaveBeenCalledTimes(1);
    });

    it('should handle errors correctly', async () => {
      const error = new Error('Something went wrong');
      ProjectLogsManager.init.mockImplementation(() => {
        throw error;
      });

      ProjectLogsManager.projectName = 'Super cool project';

      await handler({});

      expect(logApiErrorInstance).toHaveBeenCalledTimes(1);
      expect(logApiErrorInstance).toHaveBeenCalledWith(error, {
        accountId: accountId,
        projectName: ProjectLogsManager.projectName,
      });

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
