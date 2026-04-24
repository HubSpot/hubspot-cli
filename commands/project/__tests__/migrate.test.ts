import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../../lib/ui/logger.js';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';
import { ProjectMigrateArgs } from '../migrate.js';
import migrateCommand from '../migrate.js';
import { migrateApp } from '../../../lib/app/migrate.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { commands } from '../../../lang/en.js';
import { uiBetaTag, uiCommandReference } from '../../../lib/ui/index.js';
import { Mock } from 'vitest';

vi.mock('../../../lib/app/migrate');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/ui');

const { v2025_2, v2026_03_BETA, v2026_03 } = PLATFORM_VERSIONS;

describe('commands/project/migrate', () => {
  const yargsMock = yargs as Argv;
  const optionsSpy = vi.spyOn(yargsMock, 'option').mockReturnValue(yargsMock);

  // Mock the imported functions
  const migrateAppMock = migrateApp as Mock;
  const getProjectConfigMock = getProjectConfig as Mock;
  const uiBetaTagMock = uiBetaTag as Mock;
  const uiCommandReferenceMock = uiCommandReference as Mock;
  const mockExit = vi
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never);

  beforeEach(() => {
    // Mock logger methods
    vi.spyOn(uiLogger, 'log').mockImplementation(() => {});
    vi.spyOn(uiLogger, 'error').mockImplementation(() => {});
    migrateAppMock.mockResolvedValue(undefined);
    getProjectConfigMock.mockResolvedValue({
      projectConfig: { name: 'test-project' },
    });
    uiBetaTagMock.mockReturnValue('beta test description');
    uiCommandReferenceMock.mockReturnValue('command reference');
    mockExit.mockClear();
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(migrateCommand.command).toEqual('migrate');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(migrateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      migrateCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith('platform-version', {
        type: 'string',
        choices: [v2025_2, v2026_03_BETA, v2026_03],
        default: v2026_03,
      });

      expect(optionsSpy).toHaveBeenCalledWith('unstable', {
        type: 'boolean',
        default: false,
        hidden: true,
      });
    });
  });

  describe('handler', () => {
    let options: ArgumentsCamelCase<ProjectMigrateArgs>;

    beforeEach(() => {
      options = {
        platformVersion: v2025_2,
        unstable: false,
        derivedAccountId: 123,
      } as ArgumentsCamelCase<ProjectMigrateArgs>;
    });

    it('should exit with error if no project config exists', async () => {
      getProjectConfigMock.mockResolvedValue({ projectConfig: null });

      await migrateCommand.handler(options);

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.migrate.errors.noProjectConfig('command reference')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockExit).toHaveBeenCalledTimes(1);
    });

    it('should call migrateApp with correct parameters', async () => {
      await migrateCommand.handler(options);

      expect(migrateAppMock).toHaveBeenCalledWith(
        123,
        {
          ...options,
          name: 'test-project',
          platformVersion: v2025_2,
        },
        { projectConfig: { name: 'test-project' } }
      );
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockExit).toHaveBeenCalledTimes(1);
    });

    it('should use unstable platform version when unstable flag is true', async () => {
      options.unstable = true;

      await migrateCommand.handler(options);

      expect(migrateAppMock).toHaveBeenCalledWith(
        123,
        {
          ...options,
          name: 'test-project',
          platformVersion: PLATFORM_VERSIONS.UNSTABLE,
        },
        { projectConfig: { name: 'test-project' } }
      );
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockExit).toHaveBeenCalledTimes(1);
    });

    it('should handle errors and exit with error code', async () => {
      const error = new Error('Test error');
      migrateAppMock.mockRejectedValue(error);

      await migrateCommand.handler(options);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockExit).toHaveBeenCalledTimes(1);
    });
  });
});
