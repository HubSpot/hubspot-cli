import fs from 'fs';
import { v2AddComponent } from '../v2AddComponent.js';
import { getConfigForPlatformVersion } from '../../create/legacy.js';
import { createV2App } from '../../create/v2.js';
import { confirmPrompt } from '../../../prompts/promptUtils.js';
import { projectAddPromptV2 } from '../../../prompts/projectAddPrompt.js';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { uiLogger } from '../../../ui/logger.js';
import { getProjectMetadata } from '@hubspot/project-parsing-lib/src/lib/project.js';
import { trackCommandUsage } from '../../../usageTracking.js';
import {
  ProjectConfig,
  ComponentTemplate,
  ParentComponent,
} from '../../../../types/Projects.js';
import { commands } from '../../../../lang/en.js';

vi.mock('fs');
vi.mock('../../../prompts/promptUtils');
vi.mock('../../create/legacy');
vi.mock('../../create/v2');
vi.mock('../../../prompts/projectAddPrompt');
vi.mock('@hubspot/local-dev-lib/github');
vi.mock('../../../ui/logger.js');
vi.mock('@hubspot/project-parsing-lib/src/lib/project');
vi.mock('../../../usageTracking');

const mockedFs = vi.mocked(fs);
const mockedGetConfigForPlatformVersion = vi.mocked(
  getConfigForPlatformVersion
);
const mockedConfirmPrompt = vi.mocked(confirmPrompt);
const mockedCreateV2App = vi.mocked(createV2App);
const mockedProjectAddPromptV2 = vi.mocked(projectAddPromptV2);
const mockedCloneGithubRepo = vi.mocked(cloneGithubRepo);
const mockedUiLogger = vi.mocked(uiLogger);
const mockedGetProjectMetadata = vi.mocked(getProjectMetadata);
const mockedTrackCommandUsage = vi.mocked(trackCommandUsage);

describe('lib/projects/add/v2AddComponent', () => {
  const mockProjectConfig: ProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '2025.2',
  };

  const mockArgs = {
    name: 'test-component',
    type: 'module',
    derivedAccountId: 1234,
  };
  const projectDir = '/path/to/project';
  const mockAccountId = 123;

  const mockComponentTemplate: ComponentTemplate = {
    label: 'Test Component',
    path: 'test-component',
    type: 'module',
    supportedAuthTypes: ['oauth'],
    supportedDistributions: ['private'],
  };

  const mockParentComponent: ParentComponent = {
    label: 'Test App',
    type: 'app',
    authType: 'oauth',
    distribution: 'private',
    path: 'app-template',
  };

  const mockConfig = {
    components: [mockComponentTemplate],
    parentComponents: [mockParentComponent],
  };

  const mockProjectMetadata = {
    hsMetaFiles: [],
    components: {
      app: { count: 1, maxCount: 1, hsMetaFiles: ['/path/to/app.meta.json'] },
      module: { count: 0, maxCount: 5, hsMetaFiles: [] },
    },
  };

  beforeEach(() => {
    mockedCreateV2App.mockResolvedValue({
      authType: 'oauth',
      distribution: 'private',
    });
    mockedTrackCommandUsage.mockResolvedValue();
  });

  describe('v2AddComponent()', () => {
    it('successfully adds a component when app already exists', async () => {
      const mockAppMeta = {
        config: {
          distribution: 'private',
          auth: { type: 'oauth' },
        },
      };

      const mockPromptResponse = {
        componentTemplate: [mockComponentTemplate],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadata);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAppMeta));
      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedGetConfigForPlatformVersion).toHaveBeenCalledWith('2025.2');
      expect(mockedGetProjectMetadata).toHaveBeenCalledWith(
        '/path/to/project/src'
      );
      expect(mockedProjectAddPromptV2).toHaveBeenCalled();
      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'module',
        },
        mockAccountId
      );
      expect(mockedCloneGithubRepo).toHaveBeenCalledWith(
        expect.any(String),
        projectDir,
        expect.objectContaining({
          sourceDir: ['2025.2/test-component'],
          hideLogs: true,
          branch: 'main',
        })
      );
      expect(mockedUiLogger.success).toHaveBeenCalled();
    });

    it('creates an app when no app exists and user confirms', async () => {
      const mockProjectMetadataNoApps = {
        hsMetaFiles: [],
        components: {
          app: { count: 0, maxCount: 1, hsMetaFiles: [] },
          module: { count: 0, maxCount: 5, hsMetaFiles: [] },
        },
      };

      const mockPromptResponse = {
        componentTemplate: [mockComponentTemplate],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadataNoApps);
      mockedConfirmPrompt.mockResolvedValue(true);

      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedCreateV2App).toHaveBeenCalled();
      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'module',
        },
        mockAccountId
      );
      expect(mockedCloneGithubRepo).toHaveBeenCalledWith(
        expect.any(String),
        projectDir,
        expect.objectContaining({
          sourceDir: ['2025.2/test-component', '2025.2/app-template'],
        })
      );
    });

    it('should not call clone', async () => {
      const mockProjectMetadataNoApps = {
        hsMetaFiles: [],
        components: {
          app: {
            count: 1,
            maxCount: 1,
            hsMetaFiles: ['/path/to/app.meta.json'],
          },
          module: { count: 0, maxCount: 5, hsMetaFiles: [] },
        },
      };

      const mockPromptResponse = {
        componentTemplate: [],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadataNoApps);
      mockedConfirmPrompt.mockResolvedValue(true);

      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedCreateV2App).not.toHaveBeenCalled();
      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: '',
        },
        mockAccountId
      );
      expect(mockedCloneGithubRepo).not.toHaveBeenCalled();
    });

    it('throws an error when app count exceeds maximum', async () => {
      const mockProjectMetadataMaxApps = {
        hsMetaFiles: [],
        components: {
          app: { count: 2, maxCount: 1, hsMetaFiles: [] },
          module: { count: 0, maxCount: 5, hsMetaFiles: [] },
        },
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadataMaxApps);

      await expect(
        v2AddComponent(mockArgs, projectDir, mockProjectConfig, mockAccountId)
      ).rejects.toThrow(
        'This project currently has the maximum number of apps: 1'
      );
    });

    it('throws an error when components list is empty', async () => {
      const mockEmptyConfig = {
        components: [],
        parentComponents: [],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockEmptyConfig);

      await expect(
        v2AddComponent(mockArgs, projectDir, mockProjectConfig, mockAccountId)
      ).rejects.toThrow(commands.project.add.error.failedToFetchComponentList);
    });

    it('throws an error when app meta file cannot be parsed', async () => {
      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadata);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      await expect(
        v2AddComponent(mockArgs, projectDir, mockProjectConfig, mockAccountId)
      ).rejects.toThrow('Unable to parse app file');
    });

    it('throws an error when cloning fails', async () => {
      const mockAppMeta = {
        config: {
          distribution: 'private',
          auth: { type: 'oauth' },
        },
      };

      const mockPromptResponse = {
        componentTemplate: [mockComponentTemplate],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadata);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAppMeta));
      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockRejectedValue(new Error('Clone failed'));

      await expect(
        v2AddComponent(mockArgs, projectDir, mockProjectConfig, mockAccountId)
      ).rejects.toThrow(commands.project.add.error.failedToDownloadComponent);
    });

    it('should track usage with multiple component types', async () => {
      const mockAppMeta = {
        config: {
          distribution: 'private',
          auth: { type: 'oauth' },
        },
      };

      const mockSecondComponentTemplate: ComponentTemplate = {
        label: 'Test Card',
        path: 'test-card',
        type: 'card',
        supportedAuthTypes: ['oauth'],
        supportedDistributions: ['private'],
      };

      const mockPromptResponse = {
        componentTemplate: [mockComponentTemplate, mockSecondComponentTemplate],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadata);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAppMeta));
      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'module,card',
        },
        mockAccountId
      );
    });

    it('should track usage with empty type when no components are selected', async () => {
      const mockProjectMetadataNoApps = {
        hsMetaFiles: [],
        components: {
          app: {
            count: 1,
            maxCount: 1,
            hsMetaFiles: ['/path/to/app.meta.json'],
          },
          module: { count: 0, maxCount: 5, hsMetaFiles: [] },
        },
      };

      const mockPromptResponse = {
        componentTemplate: [],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadataNoApps);
      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: '',
        },
        mockAccountId
      );
    });

    it('should track usage with cliSelector when available', async () => {
      const mockAppMeta = {
        config: {
          distribution: 'private',
          auth: { type: 'oauth' },
        },
      };

      const mockComponentTemplateWithCliSelector: ComponentTemplate = {
        label: 'Workflow Action Tool',
        path: 'workflow-action-tool',
        type: 'workflow-action',
        cliSelector: 'workflow-action-tool',
        supportedAuthTypes: ['oauth'],
        supportedDistributions: ['private'],
      };

      const mockPromptResponse = {
        componentTemplate: [mockComponentTemplateWithCliSelector],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadata);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAppMeta));
      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'workflow-action-tool',
        },
        mockAccountId
      );
    });

    it('should track usage with cliSelector for multiple components', async () => {
      const mockAppMeta = {
        config: {
          distribution: 'private',
          auth: { type: 'oauth' },
        },
      };

      const mockComponentWithCliSelector: ComponentTemplate = {
        label: 'Workflow Action Tool',
        path: 'workflow-action-tool',
        type: 'workflow-action',
        cliSelector: 'workflow-action-tool',
        supportedAuthTypes: ['oauth'],
        supportedDistributions: ['private'],
      };

      const mockComponentWithoutCliSelector: ComponentTemplate = {
        label: 'Regular Module',
        path: 'module',
        type: 'module',
        supportedAuthTypes: ['oauth'],
        supportedDistributions: ['private'],
      };

      const mockPromptResponse = {
        componentTemplate: [
          mockComponentWithCliSelector,
          mockComponentWithoutCliSelector,
        ],
      };

      mockedGetConfigForPlatformVersion.mockResolvedValue(mockConfig);
      mockedGetProjectMetadata.mockResolvedValue(mockProjectMetadata);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAppMeta));
      mockedProjectAddPromptV2.mockResolvedValue(mockPromptResponse);
      mockedCloneGithubRepo.mockResolvedValue(true);

      await v2AddComponent(
        mockArgs,
        projectDir,
        mockProjectConfig,
        mockAccountId
      );

      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'project-add',
        {
          type: 'workflow-action-tool,module',
        },
        mockAccountId
      );
    });
  });
});
