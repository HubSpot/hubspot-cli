import { MockedFunction } from 'vitest';
import getStartedCommand from '../getStarted.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { projectNameAndDestPrompt } from '../../lib/prompts/projectNameAndDestPrompt.js';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import {
  getProjectConfig,
  writeProjectConfig,
} from '../../lib/projects/config.js';
import {
  getProjectPackageJsonLocations,
  installPackages,
} from '../../lib/dependencyManagement.js';
import { GET_STARTED_OPTIONS } from '../../lib/constants.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import open from 'open';

vi.mock('../../lib/usageTracking');
vi.mock('../../lib/prompts/promptUtils');
vi.mock('../../lib/prompts/projectNameAndDestPrompt');
vi.mock('../../lib/projects/config');
vi.mock('../../lib/ui/logger');
vi.mock('../../lib/errorHandlers');
vi.mock('@hubspot/local-dev-lib/github');
vi.mock('../../lib/dependencyManagement');

vi.mock('open');
vi.mock('fs-extra', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue('{"name": "test-project"}'),
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue(['file1.js', 'file2.js']),
  },
}));

describe('commands/get-started', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(getStartedCommand.command).toEqual('get-started');
    });
  });

  describe('describe', () => {
    it('should have a defined describe property', () => {
      expect(getStartedCommand.describe).toBeDefined();
    });
  });

  describe('command structure', () => {
    it('should have handler function', () => {
      expect(getStartedCommand.handler).toBeDefined();
      expect(typeof getStartedCommand.handler).toBe('function');
    });

    it('should have builder function', () => {
      expect(getStartedCommand.builder).toBeDefined();
      expect(typeof getStartedCommand.builder).toBe('function');
    });
  });

  describe('handler', () => {
    const mockArgs = {
      derivedAccountId: 12345,
      templateSource: undefined,
      name: 'test-project',
      dest: 'test-destination',
      d: false,
      debug: false,
      c: undefined,
      config: undefined,
      a: undefined,
      account: undefined,
      'use-env': undefined,
      useEnv: undefined,
      _: [],
      $0: 'hs',
    };

    beforeEach(() => {
      vi.clearAllMocks();
      (
        trackCommandUsage as MockedFunction<typeof trackCommandUsage>
      ).mockResolvedValue(undefined);
      (
        projectNameAndDestPrompt as MockedFunction<
          typeof projectNameAndDestPrompt
        >
      ).mockResolvedValue({
        dest: 'test-destination',
        name: 'test-project',
      });
      (
        cloneGithubRepo as MockedFunction<typeof cloneGithubRepo>
      ).mockResolvedValue(true);
      (
        getProjectConfig as MockedFunction<typeof getProjectConfig>
      ).mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });
      (
        writeProjectConfig as MockedFunction<typeof writeProjectConfig>
      ).mockResolvedValue(true);
      (
        getProjectPackageJsonLocations as MockedFunction<
          typeof getProjectPackageJsonLocations
        >
      ).mockResolvedValue(['/path/to/package/dir']);
      (
        installPackages as MockedFunction<typeof installPackages>
      ).mockResolvedValue(undefined);

      process.exit = vi.fn() as unknown as MockedFunction<typeof process.exit>;
    });

    describe('CMS flow', () => {
      it('should handle CMS option selection', async () => {
        (promptUser as MockedFunction<typeof promptUser>).mockResolvedValue({
          default: GET_STARTED_OPTIONS.CMS,
        });

        await getStartedCommand.handler(mockArgs);

        expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      });

      it('should open Design Manager when user confirms and browser is available', async () => {
        (promptUser as MockedFunction<typeof promptUser>)
          .mockResolvedValueOnce({ default: GET_STARTED_OPTIONS.CMS })
          .mockResolvedValueOnce({ shouldOpen: true });

        await getStartedCommand.handler(mockArgs);

        expect(open).toHaveBeenCalledWith(
          expect.stringContaining('design-manager'),
          { url: true }
        );
      });
    });

    describe('App flow', () => {
      beforeEach(() => {
        (promptUser as MockedFunction<typeof promptUser>)
          .mockResolvedValueOnce({
            default: GET_STARTED_OPTIONS.APP,
          })
          .mockResolvedValueOnce({
            shouldUpload: true,
          });
      });

      it('should handle App option selection', async () => {
        await getStartedCommand.handler(mockArgs);

        expect(projectNameAndDestPrompt).toHaveBeenCalledWith(mockArgs);
        expect(cloneGithubRepo).toHaveBeenCalled();
      });

      it('should handle upload flow when user confirms', async () => {
        (promptUser as MockedFunction<typeof promptUser>)
          .mockResolvedValueOnce({ default: GET_STARTED_OPTIONS.APP })
          .mockResolvedValueOnce({ shouldUpload: true });

        const mockProjectConfig = {
          name: 'test-project',
          srcDir: 'src',
          platformVersion: '1.0.0',
        };
        (getProjectConfig as MockedFunction<typeof getProjectConfig>)

          .mockResolvedValueOnce({
            projectConfig: null,
            projectDir: null,
          })
          .mockResolvedValueOnce({
            projectConfig: mockProjectConfig,
            projectDir: '/path/to/project',
          });

        await getStartedCommand.handler(mockArgs);

        expect(promptUser).toHaveBeenCalledWith([
          expect.objectContaining({
            type: 'confirm',
            name: 'shouldUpload',
            message: expect.any(String),
            default: true,
          }),
        ]);
      });
    });

    describe('tracking', () => {
      it('should track command usage', async () => {
        (promptUser as MockedFunction<typeof promptUser>).mockResolvedValue({
          default: GET_STARTED_OPTIONS.APP,
        });

        await getStartedCommand.handler(mockArgs);

        expect(trackCommandUsage).toHaveBeenCalledWith(
          'get-started',
          {},
          mockArgs.derivedAccountId
        );
      });
    });
  });
});
