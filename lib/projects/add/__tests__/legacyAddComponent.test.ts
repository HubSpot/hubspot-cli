import { legacyAddComponent } from '../legacyAddComponent.js';
import { findProjectComponents } from '../../structure.js';
import { getProjectComponentListFromRepo } from '../../create/legacy.js';
import { projectAddPrompt } from '../../../prompts/projectAddPrompt.js';
import { uiLogger } from '../../../ui/logger.js';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { trackCommandUsage } from '../../../usageTracking.js';
import {
  ComponentTypes,
  ProjectConfig,
  Component,
  ComponentTemplate,
} from '../../../../types/Projects.js';
import { commands } from '../../../../lang/en.js';

vi.mock('../../structure');
vi.mock('../../create/legacy');
vi.mock('../../../prompts/projectAddPrompt');
vi.mock('../../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/github');
vi.mock('../../../usageTracking.js');

const mockedFindProjectComponents = vi.mocked(findProjectComponents);
const mockedGetProjectComponentListFromRepo = vi.mocked(
  getProjectComponentListFromRepo
);
const mockedProjectAddPrompt = vi.mocked(projectAddPrompt);
const mockedUiLogger = vi.mocked(uiLogger);
const mockedCloneGithubRepo = vi.mocked(cloneGithubRepo);
const mockedTrackCommandUsage = vi.mocked(trackCommandUsage);

describe('lib/projects/add/legacyAddComponent', () => {
  const mockProjectConfig: ProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: 'v1',
  };

  const accountId = 1234567890;

  const mockArgs = { name: 'test-component', type: 'module' };
  const projectDir = '/path/to/project';

  beforeEach(() => {
    vi.resetAllMocks();
    mockedTrackCommandUsage.mockResolvedValue();
  });

  describe('legacyAddComponent()', () => {
    it('successfully adds a component to a project without public apps', async () => {
      const mockComponents: Component[] = [
        {
          type: ComponentTypes.PrivateApp,
          config: {
            name: 'private-app',
            description: '',
            uid: '',
            scopes: [],
            public: false,
          },
          runnable: true,
          path: '/path/to/private-app',
        },
      ];
      const mockComponentList: ComponentTemplate[] = [
        { label: 'Test Component', path: 'test-component', type: 'module' },
      ];
      const mockPromptResponse = {
        name: 'new-component',
        componentTemplate: {
          label: 'Test Component',
          path: 'template-path',
          type: 'module',
        },
      };

      mockedFindProjectComponents.mockResolvedValue(mockComponents);
      mockedGetProjectComponentListFromRepo.mockResolvedValue(
        mockComponentList
      );
      mockedProjectAddPrompt.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await legacyAddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        accountId
      );

      expect(mockedFindProjectComponents).toHaveBeenCalledWith(projectDir);
      expect(mockedGetProjectComponentListFromRepo).toHaveBeenCalledWith('v1');
      expect(mockedProjectAddPrompt).toHaveBeenCalledWith(
        mockComponentList,
        mockArgs
      );
      expect(mockedCloneGithubRepo).toHaveBeenCalledWith(
        expect.any(String),
        '/path/to/project/src/new-component',
        expect.objectContaining({
          sourceDir: 'template-path',
          branch: 'main',
          hideLogs: true,
        })
      );
      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'module',
        },
        accountId
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.add.creatingComponent('test-project')
      );
      expect(mockedUiLogger.success).toHaveBeenCalledWith(
        commands.project.add.success('new-component')
      );
    });

    it('throws an error when project contains a public app', async () => {
      const mockComponents: Component[] = [
        {
          type: ComponentTypes.PublicApp,
          config: {
            name: 'public-app',
            uid: '',
            description: '',
            allowedUrls: [],
            auth: {
              redirectUrls: [],
              requiredScopes: [],
              optionalScopes: [],
              conditionallyRequiredScopes: [],
            },
            support: {
              supportEmail: '',
              documentationUrl: '',
              supportUrl: '',
              supportPhone: '',
            },
          },
          runnable: true,
          path: '/path/to/public-app',
        },
      ];

      mockedFindProjectComponents.mockResolvedValue(mockComponents);

      await expect(
        legacyAddComponent(mockArgs, projectDir, mockProjectConfig, accountId)
      ).rejects.toThrow(commands.project.add.error.projectContainsPublicApp);

      expect(mockedGetProjectComponentListFromRepo).not.toHaveBeenCalled();
      expect(mockedProjectAddPrompt).not.toHaveBeenCalled();
      expect(mockedCloneGithubRepo).not.toHaveBeenCalled();
    });

    it('continues when findProjectComponents throws an error', async () => {
      const mockComponentList: ComponentTemplate[] = [
        { label: 'Test Component', path: 'test-component', type: 'module' },
      ];
      const mockPromptResponse = {
        name: 'new-component',
        componentTemplate: {
          label: 'Test Component',
          path: 'template-path',
          type: 'module',
        },
      };

      mockedFindProjectComponents.mockRejectedValue(
        new Error('Find components error')
      );
      mockedGetProjectComponentListFromRepo.mockResolvedValue(
        mockComponentList
      );
      mockedProjectAddPrompt.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await legacyAddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        accountId
      );

      expect(mockedGetProjectComponentListFromRepo).toHaveBeenCalledWith('v1');
      expect(mockedProjectAddPrompt).toHaveBeenCalledWith(
        mockComponentList,
        mockArgs
      );
      expect(mockedCloneGithubRepo).toHaveBeenCalled();
    });

    it('throws an error when component list is empty', async () => {
      const mockComponents: Component[] = [
        {
          type: ComponentTypes.PrivateApp,
          config: {
            name: 'private-app',
            description: '',
            uid: '',
            scopes: [],
            public: false,
          },
          runnable: true,
          path: '/path/to/private-app',
        },
      ];

      mockedFindProjectComponents.mockResolvedValue(mockComponents);
      mockedGetProjectComponentListFromRepo.mockResolvedValue([]);

      await expect(
        legacyAddComponent(mockArgs, projectDir, mockProjectConfig, accountId)
      ).rejects.toThrow(commands.project.add.error.failedToFetchComponentList);

      expect(mockedProjectAddPrompt).not.toHaveBeenCalled();
      expect(mockedCloneGithubRepo).not.toHaveBeenCalled();
    });

    it('throws an error when component list is null', async () => {
      const mockComponents: Component[] = [
        {
          type: ComponentTypes.PrivateApp,
          config: {
            name: 'private-app',
            description: '',
            uid: '',
            scopes: [],
            public: false,
          },
          runnable: true,
          path: '/path/to/private-app',
        },
      ];

      mockedFindProjectComponents.mockResolvedValue(mockComponents);
      // @ts-expect-error Breaking stuff on purpose
      mockedGetProjectComponentListFromRepo.mockResolvedValue(null);

      await expect(
        legacyAddComponent(mockArgs, projectDir, mockProjectConfig, accountId)
      ).rejects.toThrow(commands.project.add.error.failedToFetchComponentList);

      expect(mockedProjectAddPrompt).not.toHaveBeenCalled();
      expect(mockedCloneGithubRepo).not.toHaveBeenCalled();
    });

    it('throws an error when cloning fails', async () => {
      const mockComponents: Component[] = [
        {
          type: ComponentTypes.PrivateApp,
          config: {
            name: 'private-app',
            description: '',
            uid: '',
            scopes: [],
            public: false,
          },
          runnable: true,
          path: '/path/to/private-app',
        },
      ];
      const mockComponentList: ComponentTemplate[] = [
        { label: 'Test Component', path: 'test-component', type: 'module' },
      ];
      const mockPromptResponse = {
        name: 'new-component',
        componentTemplate: {
          label: 'Test Component',
          path: 'template-path',
          type: 'module',
        },
      };

      mockedFindProjectComponents.mockResolvedValue(mockComponents);
      mockedGetProjectComponentListFromRepo.mockResolvedValue(
        mockComponentList
      );
      mockedProjectAddPrompt.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockRejectedValue(new Error('Clone failed'));

      await expect(
        legacyAddComponent(mockArgs, projectDir, mockProjectConfig, accountId)
      ).rejects.toThrow(commands.project.add.error.failedToDownloadComponent);

      expect(mockedCloneGithubRepo).toHaveBeenCalled();
      expect(mockedUiLogger.success).not.toHaveBeenCalled();
    });

    it('calls trackCommandUsage with correct component type', async () => {
      const mockComponents: Component[] = [
        {
          type: ComponentTypes.PrivateApp,
          config: {
            name: 'private-app',
            description: '',
            uid: '',
            scopes: [],
            public: false,
          },
          runnable: true,
          path: '/path/to/private-app',
        },
      ];
      const mockComponentList: ComponentTemplate[] = [
        { label: 'Card Component', path: 'card-component', type: 'card' },
      ];
      const mockPromptResponse = {
        name: 'new-card',
        componentTemplate: {
          label: 'Card Component',
          path: 'card-template-path',
          type: 'card',
        },
      };

      mockedFindProjectComponents.mockResolvedValue(mockComponents);
      mockedGetProjectComponentListFromRepo.mockResolvedValue(
        mockComponentList
      );
      mockedProjectAddPrompt.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await legacyAddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        accountId
      );

      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'card',
        },
        accountId
      );
    });
  });
});
