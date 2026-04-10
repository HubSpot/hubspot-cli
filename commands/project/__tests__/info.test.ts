import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import projectInfoCommand from '../info.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { isV2Project } from '../../../lib/projects/platformVersion.js';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import {
  getProjectInfo,
  logProjectInfo,
} from '../../../lib/projects/projectInfo.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  JSONOutputArgs,
  UsageTrackingArgs,
} from '../../../types/Yargs.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/projects/platformVersion');
vi.mock('../../../lib/projects/projectInfo');
vi.mock('../../../lib/yargs/makeYargsHandlerWithUsageTracking', () => ({
  makeYargsHandlerWithUsageTracking: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getConfigAccountIfExists: vi.fn().mockReturnValue(undefined),
  };
});

type ProjectInfoArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  JSONOutputArgs &
  UsageTrackingArgs;

const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedIsV2Project = vi.mocked(isV2Project);
const mockedFetchProject = vi.mocked(fetchProject);
const mockedGetProjectInfo = vi.mocked(getProjectInfo);
const mockedLogProjectInfo = vi.mocked(logProjectInfo);
const mockedUiLogger = vi.mocked(uiLogger);

const mockProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};

const mockProject = {
  id: 42,
  name: 'my-project',
  deployedBuild: {
    buildId: 7,
    isAutoDeployEnabled: true,
    subbuildStatuses: [],
  },
};

const mockProjectInfo = {
  projectName: 'my-project',
  platformVersion: '2025.2',
  projectId: 42,
  deployedBuildId: 7,
  autoDeployEnabled: true,
  projectUrl: 'https://app.hubspot.com/project/my-project',
  app: {
    name: 'My App',
    id: 99,
    uid: 'my-app',
    authType: 'OAUTH',
    distributionType: 'PRIVATE',
  },
  components: [
    { uid: 'card-one-uid', type: 'APP_CARD' },
    { uid: 'func-one', type: 'SERVERLESS_FUNCTION' },
  ],
};

describe('commands/project/info', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectInfoCommand.command).toEqual('info');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectInfoCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectInfoCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockArgs = {
      derivedAccountId: 100,
      formatOutputAsJson: false,
      exit: mockExit,
      addUsageMetadata: vi.fn(),
    } as unknown as ArgumentsCamelCase<ProjectInfoArgs>;

    beforeEach(() => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir: '/path/to/project',
      });
      mockedIsV2Project.mockReturnValue(true);
      mockedFetchProject.mockResolvedValue({
        data: mockProject,
      } as unknown as Awaited<ReturnType<typeof fetchProject>>);
      mockedGetProjectInfo.mockResolvedValue(mockProjectInfo);
      mockedLogProjectInfo.mockReturnValue(undefined);
    });

    it('should exit with error when no project config is found', async () => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await projectInfoCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
    });

    it('should exit with error for unsupported platform version', async () => {
      mockedIsV2Project.mockReturnValue(false);

      await projectInfoCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
    });

    it('should exit with error when project fetch fails', async () => {
      mockedFetchProject.mockRejectedValue(new Error('Not found'));

      await projectInfoCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when project has no deployed build', async () => {
      mockedFetchProject.mockResolvedValue({
        data: { ...mockProject, deployedBuild: undefined },
      } as unknown as Awaited<ReturnType<typeof fetchProject>>);

      await projectInfoCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should call getProjectInfo with correct arguments', async () => {
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInfoArgs>;

      await projectInfoCommand.handler(jsonArgs);

      expect(mockedGetProjectInfo).toHaveBeenCalledWith(
        mockProject,
        '2025.2',
        100
      );
    });

    it('should output JSON when formatOutputAsJson is true', async () => {
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInfoArgs>;

      await projectInfoCommand.handler(jsonArgs);

      expect(mockedUiLogger.json).toHaveBeenCalledWith(mockProjectInfo);
      expect(mockedLogProjectInfo).not.toHaveBeenCalled();
    });

    it('should render output when not in JSON mode', async () => {
      await projectInfoCommand.handler(mockArgs);

      expect(mockedLogProjectInfo).toHaveBeenCalledWith(mockProjectInfo);
      expect(mockedUiLogger.json).not.toHaveBeenCalled();
    });
  });
});
