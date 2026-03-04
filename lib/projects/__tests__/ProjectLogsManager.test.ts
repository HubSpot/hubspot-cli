import { ProjectLogsManager } from '../ProjectLogsManager.js';
import { getProjectConfig } from '../config.js';
import { ensureProjectExists } from '../ensureProjectExists.js';
import { fetchProjectComponentsMetadata } from '@hubspot/local-dev-lib/api/projects';
import { fetchAppMetadataBySourceId } from '@hubspot/local-dev-lib/api/appsDev';
import { getDeployedProjectNodes } from '../localDev/helpers/project.js';
import { isV2Project } from '../platformVersion.js';

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

import { Mock } from 'vitest';

vi.mock('../../projects/config');
vi.mock('../../projects/ensureProjectExists');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('../../projects/localDev/helpers/project');
vi.mock('../../projects/platformVersion');

describe('lib/projects/ProjectLogsManager', () => {
  const accountId = 12345678;
  const appId = 999999;
  const projectName = 'super cool test project';
  const projectConfig = {
    projectConfig: {
      name: projectName,
      srcDir: 'src',
      platformVersion: '2024.1',
    },
  };
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
    appId,
  };
  const functions = [
    function1,
    {
      componentName: 'function2',
      appId,
    },
  ];

  const legacyApiFunctions = [
    {
      componentName: 'function1',
      type: {
        name: SUBCOMPONENT_TYPES.APP_FUNCTION,
      },
      deployOutput: {
        appId,
        appFunctionName: 'function1',
      },
    },
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

    (isV2Project as Mock).mockReturnValue(false);
    (getProjectConfig as Mock).mockResolvedValue(projectConfig);
    (ensureProjectExists as Mock).mockResolvedValue(projectDetails);
    (fetchProjectComponentsMetadata as Mock).mockResolvedValue({
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
              ...legacyApiFunctions,
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
      (getProjectConfig as Mock).mockResolvedValue({});
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
      (ensureProjectExists as Mock).mockResolvedValue({});
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

  describe('v2 project init', () => {
    const v2ProjectConfig = {
      projectConfig: {
        name: projectName,
        srcDir: 'src',
        platformVersion: '2025.2',
      },
    };
    const deployedBuildId = 555;
    const v2ProjectDetails = {
      project: {
        id: projectId,
        deployedBuild: {
          buildId: deployedBuildId,
          subbuildStatuses: {},
        },
      },
    };
    const appUid = 'my-app';
    const fnUid1 = 'my-app/app.functions/function1';
    const fnUid2 = 'my-app/app.functions/function2';
    const deployedNodes = {
      [appUid]: {
        componentType: 'APPLICATION',
        componentDeps: {},
        metaFilePath: 'src/app/app-hsmeta.json',
        uid: appUid,
        config: {},
        files: {},
      },
      [fnUid1]: {
        componentType: 'APP_FUNCTION',
        componentDeps: { app: appUid },
        metaFilePath:
          'src/app/app.functions/function1.functions/function-hsmeta.json',
        uid: fnUid1,
        config: { endpoint: { path: '/my-endpoint' } },
        files: {},
      },
      [fnUid2]: {
        componentType: 'APP_FUNCTION',
        componentDeps: { app: appUid },
        metaFilePath:
          'src/app/app.functions/function2.functions/function-hsmeta.json',
        uid: fnUid2,
        config: {},
        files: {},
      },
    };

    beforeEach(() => {
      (getProjectConfig as Mock).mockResolvedValue(v2ProjectConfig);
      (ensureProjectExists as Mock).mockResolvedValue(v2ProjectDetails);
      (isV2Project as Mock).mockReturnValue(true);
      (getDeployedProjectNodes as Mock).mockResolvedValue(deployedNodes);
      (fetchAppMetadataBySourceId as Mock).mockResolvedValue({
        data: { id: appId },
      });
    });

    it('should populate functions correctly for v2 projects', async () => {
      await ProjectLogsManager.init(accountId);
      expect(getDeployedProjectNodes).toHaveBeenCalledWith(
        v2ProjectConfig.projectConfig,
        accountId,
        deployedBuildId
      );
      expect(fetchAppMetadataBySourceId).toHaveBeenCalledWith(
        projectId,
        appUid,
        accountId
      );
      expect(ProjectLogsManager.functions).toEqual([
        {
          componentName: fnUid1,
          appId,
          endpoint: { path: '/my-endpoint' },
        },
        {
          componentName: fnUid2,
          appId,
          endpoint: undefined,
        },
      ]);
    });

    it('should throw noDeployedBuild when buildId is missing', async () => {
      (ensureProjectExists as Mock).mockResolvedValue({
        project: {
          id: projectId,
          deployedBuild: {
            buildId: undefined,
            subbuildStatuses: {},
          },
        },
      });
      await expect(async () =>
        ProjectLogsManager.init(accountId)
      ).rejects.toThrow(
        'This project has not been deployed yet. Deploy the project first, then try again.'
      );
    });

    it('should throw noFunctionsInProject when no function nodes exist', async () => {
      (getDeployedProjectNodes as Mock).mockResolvedValue({
        [appUid]: deployedNodes[appUid],
      });
      await expect(async () =>
        ProjectLogsManager.init(accountId)
      ).rejects.toThrow(/There aren't any functions in this project/);
    });

    it('should throw a user-friendly error when getDeployedProjectNodes fails', async () => {
      (getDeployedProjectNodes as Mock).mockRejectedValue(
        new Error('download failed')
      );
      await expect(async () =>
        ProjectLogsManager.init(accountId)
      ).rejects.toThrow(/There was an error fetching project details/);
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
        appId: 123,
        endpoint: { path: 'yooooooo' },
      };
      ProjectLogsManager.functions = [functionToChoose];
      ProjectLogsManager.setFunction('function1');
      expect(ProjectLogsManager.functionName).toEqual('function1');
      expect(ProjectLogsManager.endpointName).toEqual('yooooooo');
      expect(ProjectLogsManager.selectedFunction).toEqual(functionToChoose);
      expect(ProjectLogsManager.isPublicFunction).toEqual(true);
    });

    it('should set the data correctly for private functions', async () => {
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
