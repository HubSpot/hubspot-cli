import { ProjectLogsManager } from '../projects/ProjectLogsManager';
import { getProjectConfig, ensureProjectExists } from '../projects';
import { fetchProjectComponentsMetadata } from '@hubspot/local-dev-lib/api/projects';

const SUBCOMPONENT_TYPES = {
  APP_ID: 'APP_ID',
  PACKAGE_LOCK_FILE: 'PACKAGE_LOCK_FILE',
  CRM_CARD_V2: 'CRM_CARD_V2',
  CARD_V2: 'CARD_V2',
  SERVERLESS_PKG: 'SERVERLESS_PKG',
  SERVERLESS_ROUTE: 'SERVERLESS_ROUTE',
  SERVERLESS_FUNCTION: 'SERVERLESS_FUNCTION',
  APP_FUNCTION: 'APP_FUNCTION',
  AUTOMATION_ACTION: 'AUTOMATION_ACTION',
  REACT_EXTENSION: 'REACT_EXTENSION',
} as const;

jest.mock('../projects');
jest.mock('@hubspot/local-dev-lib/api/projects');

describe('lib/projects/ProjectLogsManager', () => {
  const accountId = 12345678;
  const appId = 999999;
  const projectName = 'super cool test project';
  const projectConfig = { projectConfig: { name: projectName } };
  const projectId = 987654321;
  const projectDetails = {
    project: {
      id: projectId,
      deployedBuild: {
        subbuildStatuses: {},
      },
    },
  };

  const function1 = {
    componentName: 'function1',
    type: {
      name: SUBCOMPONENT_TYPES.APP_FUNCTION,
    },
    deployOutput: {
      appId,
      appFunctionName: 'function1',
    },
  };
  const functions = [
    function1,
    {
      componentName: 'function2',
      type: {
        name: SUBCOMPONENT_TYPES.APP_FUNCTION,
      },
      deployOutput: {
        appId,
        appFunctionName: 'function2',
      },
    },
  ];

  beforeEach(() => {
    ProjectLogsManager.reset();

    (getProjectConfig as jest.Mock).mockResolvedValue(projectConfig);
    (ensureProjectExists as jest.Mock).mockResolvedValue(projectDetails);
    (fetchProjectComponentsMetadata as jest.Mock).mockResolvedValue({
      data: {
        topLevelComponentMetadata: [
          {
            type: {
              name: 'PRIVATE_APP',
            },
            deployOutput: {
              appId,
            },
            featureComponents: [
              ...functions,
              {
                type: {
                  name: 'NOT_AN_APP_FUNCTION',
                },
              },
            ],
          },
        ],
      },
    });
  });

  describe('init', () => {
    it('should load the project config', async () => {
      await ProjectLogsManager.init(accountId);
      expect(getProjectConfig).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if there is a problem with the config', async () => {
      (getProjectConfig as jest.Mock).mockResolvedValue({});
      await expect(async () =>
        ProjectLogsManager.init(accountId)
      ).rejects.toThrow(
        'No project detected. Run this command again from a project directory.'
      );
      expect(getProjectConfig).toHaveBeenCalledTimes(1);
    });

    it('should ensure the project exists', async () => {
      await ProjectLogsManager.init(accountId);
      expect(ensureProjectExists).toHaveBeenCalledTimes(1);
      expect(ensureProjectExists).toHaveBeenCalledWith(accountId, projectName, {
        allowCreate: false,
      });
    });

    it('should throw an error if there is data missing from the project details', async () => {
      (ensureProjectExists as jest.Mock).mockResolvedValue({});
      await expect(async () =>
        ProjectLogsManager.init(accountId)
      ).rejects.toThrow(/There was an error fetching project details/);
    });

    it('should set all of the expected fields correctly', async () => {
      await ProjectLogsManager.init(accountId);
      expect(ProjectLogsManager.projectId).toEqual(projectId);
      expect(ProjectLogsManager.projectName).toEqual(projectName);
      expect(ProjectLogsManager.accountId).toEqual(accountId);
      expect(ProjectLogsManager.functions).toEqual(functions);
    });
  });

  describe('fetchFunctionDetails', () => {
    it('should throw an error if the projectId is null when the method is called', async () => {
      await expect(async () =>
        ProjectLogsManager.fetchFunctionDetails()
      ).rejects.toThrow(
        'No project detected. Run this command again from a project directory.'
      );
    });

    it('should fetch the component metadata', async () => {
      ProjectLogsManager.projectId = projectId;
      ProjectLogsManager.accountId = accountId;
      await ProjectLogsManager.fetchFunctionDetails();
      expect(fetchProjectComponentsMetadata).toHaveBeenCalledTimes(1);
      expect(fetchProjectComponentsMetadata).toHaveBeenCalledWith(
        accountId,
        projectId
      );
    });

    it('should set the functions correctly', async () => {
      ProjectLogsManager.projectId = projectId;
      ProjectLogsManager.accountId = accountId;
      await ProjectLogsManager.fetchFunctionDetails();
      expect(ProjectLogsManager.functions).toEqual(functions);
    });
  });

  describe('getFunctionNames', () => {
    it('should return an empty array if functions is empty', async () => {
      ProjectLogsManager.functions = [];
      expect(ProjectLogsManager.getFunctionNames()).toEqual([]);
    });

    it('should return an array of the componentNames', async () => {
      ProjectLogsManager.functions = functions;
      expect(ProjectLogsManager.getFunctionNames()).toEqual([
        'function1',
        'function2',
      ]);
    });
  });

  describe('setFunction', () => {
    it('should throw an error when functions is empty', async () => {
      ProjectLogsManager.functions = [];
      expect(() => ProjectLogsManager.setFunction('foo')).toThrow(
        `There aren't any functions in this project`
      );
    });

    it('should throw an error when the provided function is invalid', async () => {
      ProjectLogsManager.functions = functions;
      const badName = 'foo';
      expect(() => ProjectLogsManager.setFunction(badName)).toThrow(
        `No function with name "${badName}"`
      );
    });

    it('should set the data correctly for public functions', async () => {
      const functionToChoose = {
        componentName: 'function1',
        type: {
          name: SUBCOMPONENT_TYPES.APP_FUNCTION,
        },
        deployOutput: {
          appId: 123,
          appFunctionName: 'function1',
          endpoint: { path: 'yooooooo', methods: ['GET'] },
        },
      };
      ProjectLogsManager.functions = [functionToChoose];
      ProjectLogsManager.setFunction('function1');
      expect(ProjectLogsManager.functionName).toEqual('function1');
      expect(ProjectLogsManager.endpointName).toEqual('yooooooo');
      expect(ProjectLogsManager.selectedFunction).toEqual(functionToChoose);
      expect(ProjectLogsManager.isPublicFunction).toEqual(true);
    });

    it('should set the data correctly for public functions', async () => {
      ProjectLogsManager.functions = functions;
      ProjectLogsManager.setFunction('function1');
      expect(ProjectLogsManager.selectedFunction).toEqual(function1);
      expect(ProjectLogsManager.functionName).toEqual('function1');
      expect(ProjectLogsManager.isPublicFunction).toEqual(false);
    });
  });

  describe('reset', () => {
    it('should reset all the values', async () => {
      ProjectLogsManager.projectName = 'value';
      expect(ProjectLogsManager.projectName).toBeDefined();

      ProjectLogsManager.reset();
      expect(ProjectLogsManager.projectName).toBeUndefined();
    });
  });
});
