import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { ProjectMigrateArgs } from '../migrate';
import migrateCommand from '../migrate';
import { migrateApp2025_2 } from '../../../lib/app/migrate';
import { getProjectConfig } from '../../../lib/projects/config';
import { commands } from '../../../lang/en';
import { uiBetaTag, uiCommandReference } from '../../../lib/ui';

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/app/migrate');
jest.mock('../../../lib/projects/config');
jest.mock('../../../lib/ui');

const { v2025_2 } = PLATFORM_VERSIONS;

describe('commands/project/migrate', () => {
  const yargsMock = yargs as Argv;
  const optionsSpy = jest.spyOn(yargsMock, 'option').mockReturnValue(yargsMock);

  // Mock the imported functions
  const migrateApp2025_2Mock = migrateApp2025_2 as jest.Mock;
  const getProjectConfigMock = getProjectConfig as jest.Mock;
  const uiBetaTagMock = uiBetaTag as jest.Mock;
  const uiCommandReferenceMock = uiCommandReference as jest.Mock;

  beforeEach(() => {
    // Mock logger methods
    jest.spyOn(logger, 'log').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
    migrateApp2025_2Mock.mockResolvedValue(undefined);
    getProjectConfigMock.mockResolvedValue({
      projectConfig: { name: 'test-project' },
    });
    uiBetaTagMock.mockReturnValue('beta test description');
    uiCommandReferenceMock.mockReturnValue('command reference');
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(migrateCommand.command).toEqual('migrate');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(migrateCommand.describe).toBe(undefined);
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      migrateCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith('platform-version', {
        type: 'string',
        choices: [v2025_2],
        default: v2025_2,
        hidden: true,
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
    let mockExit: jest.SpyInstance;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation();
      options = {
        platformVersion: v2025_2,
        unstable: false,
        derivedAccountId: 123,
      } as ArgumentsCamelCase<ProjectMigrateArgs>;
    });

    afterEach(() => {
      mockExit.mockRestore();
    });

    it('should exit with error if no project config exists', async () => {
      getProjectConfigMock.mockResolvedValue({ projectConfig: null });

      await migrateCommand.handler(options);

      expect(logger.error).toHaveBeenCalledWith(
        commands.project.migrate.errors.noProjectConfig('command reference')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should call migrateApp2025_2 with correct parameters', async () => {
      await migrateCommand.handler(options);

      expect(migrateApp2025_2Mock).toHaveBeenCalledWith(
        123,
        {
          ...options,
          name: 'test-project',
          platformVersion: v2025_2,
        },
        { projectConfig: { name: 'test-project' } }
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should use unstable platform version when unstable flag is true', async () => {
      options.unstable = true;

      await migrateCommand.handler(options);

      expect(migrateApp2025_2Mock).toHaveBeenCalledWith(
        123,
        {
          ...options,
          name: 'test-project',
          platformVersion: PLATFORM_VERSIONS.unstable,
        },
        { projectConfig: { name: 'test-project' } }
      );
    });

    it('should handle errors and exit with error code', async () => {
      const error = new Error('Test error');
      migrateApp2025_2Mock.mockRejectedValue(error);

      await migrateCommand.handler(options);

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
