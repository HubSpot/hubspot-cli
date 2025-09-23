import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import projectAddCommand, { ProjectAddArgs } from '../add.js';
import {
  marketplaceDistribution,
  oAuth,
  privateDistribution,
  staticAuth,
} from '../../../lib/constants.js';
import { v3AddComponent } from '../../../lib/projects/add/v3AddComponent.js';
import { legacyAddComponent } from '../../../lib/projects/add/legacyAddComponent.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { isV2Project } from '../../../lib/projects/platformVersion.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/projects/add/v3AddComponent');
vi.mock('../../../lib/projects/add/legacyAddComponent');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/projects/platformVersion');
vi.mock('../../../lib/usageTracking');

const mockedV3AddComponent = vi.mocked(v3AddComponent);
const mockedLegacyAddComponent = vi.mocked(legacyAddComponent);
const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedUseV3Api = vi.mocked(isV2Project);
const mockedTrackCommandUsage = vi.mocked(trackCommandUsage);

describe('commands/project/add', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectAddCommand.command).toEqual('add');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectAddCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectAddCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(2);
      expect(yargsMock.options).toHaveBeenCalledWith({
        auth: expect.objectContaining({
          type: 'string',
          choices: expect.arrayContaining([staticAuth, oAuth]),
        }),
        distribution: expect.objectContaining({
          type: 'string',
          choices: expect.arrayContaining([
            privateDistribution,
            marketplaceDistribution,
          ]),
        }),
        features: expect.objectContaining({
          type: 'array',
        }),
        name: expect.objectContaining({
          type: 'string',
        }),
        type: expect.objectContaining({ type: 'string' }),
      });
    });
  });

  describe('handler', () => {
    const mockProjectConfig = {
      name: 'test-project',
      srcDir: 'src',
      platformVersion: 'v3',
    };
    const mockProjectDir = '/path/to/project';
    const mockArgs = {
      derivedAccountId: 123,
      name: 'test-component',
      type: 'module',
    } as ArgumentsCamelCase<ProjectAddArgs>;

    beforeEach(() => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });
      mockedTrackCommandUsage.mockResolvedValue();
      mockedV3AddComponent.mockResolvedValue();
      mockedLegacyAddComponent.mockResolvedValue();
      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    it('should call v3AddComponent with accountId for v3 projects', async () => {
      mockedUseV3Api.mockReturnValue(true);

      await expect(projectAddCommand.handler(mockArgs)).rejects.toThrow(
        'process.exit called'
      );

      expect(mockedV3AddComponent).toHaveBeenCalledWith(
        mockArgs,
        mockProjectDir,
        mockProjectConfig,
        123
      );
      expect(mockedLegacyAddComponent).not.toHaveBeenCalled();
    });

    it('should call legacyAddComponent for non-v3 projects', async () => {
      mockedUseV3Api.mockReturnValue(false);

      await expect(projectAddCommand.handler(mockArgs)).rejects.toThrow(
        'process.exit called'
      );

      expect(mockedLegacyAddComponent).toHaveBeenCalledWith(
        mockArgs,
        mockProjectDir,
        mockProjectConfig,
        123
      );
      expect(mockedV3AddComponent).not.toHaveBeenCalled();
    });

    it('should exit with error when project config is not found', async () => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(projectAddCommand.handler(mockArgs)).rejects.toThrow(
        'process.exit called'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });
});
