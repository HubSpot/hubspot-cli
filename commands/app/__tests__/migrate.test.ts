import { ArgumentsCamelCase, Argv } from 'yargs';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { migrateApp2025_2, MigrateAppArgs } from '../../../lib/app/migrate';
import { migrateApp2023_2 } from '../../../lib/app/migrate_legacy';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import migrateCommand from '../migrate';

jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/app/migrate');
jest.mock('../../../lib/app/migrate_legacy');
jest.mock('yargs');

const mockedGetAccountConfig = getAccountConfig as jest.Mock;
const mockedMigrateApp2023_2 = migrateApp2023_2 as jest.Mock;
const mockedMigrateApp2025_2 = migrateApp2025_2 as jest.Mock;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('commands/app/migrate', () => {
  const mockAccountId = 123;
  const mockAccountConfig = {
    name: 'Test Account',
    env: 'prod',
  };
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
    mockedGetAccountConfig.mockReturnValue(mockAccountConfig);
  });

  describe('handler', () => {
    it('should exit with error when no account config is found', async () => {
      mockedGetAccountConfig.mockReturnValue(null);

      await migrateCommand.handler({
        derivedAccountId: mockAccountId,
      } as ArgumentsCamelCase<MigrateAppArgs>);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      exitSpy.mockRestore();
    });

    it('should call migrateApp2025_2 for platform version 2025.2', async () => {
      await migrateCommand.handler({
        derivedAccountId: mockAccountId,
        platformVersion: PLATFORM_VERSIONS.v2025_2,
      } as ArgumentsCamelCase<MigrateAppArgs>);

      expect(mockedMigrateApp2025_2).toHaveBeenCalledWith(
        mockAccountId,
        expect.any(Object)
      );
      expect(mockedMigrateApp2023_2).not.toHaveBeenCalled();
    });

    it('should call migrateApp2023_2 for platform version 2023.2', async () => {
      await migrateCommand.handler({
        derivedAccountId: mockAccountId,
        platformVersion: PLATFORM_VERSIONS.v2023_2,
      } as ArgumentsCamelCase<MigrateAppArgs>);

      expect(mockedMigrateApp2023_2).toHaveBeenCalledWith(
        mockAccountId,
        expect.any(Object),
        mockAccountConfig
      );
      expect(mockedMigrateApp2025_2).not.toHaveBeenCalled();
    });

    it('should handle errors during migration', async () => {
      const mockError = new Error('Migration failed');
      mockedMigrateApp2023_2.mockRejectedValue(mockError);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await migrateCommand.handler({
        derivedAccountId: mockAccountId,
        platformVersion: PLATFORM_VERSIONS.v2023_2,
      } as ArgumentsCamelCase<MigrateAppArgs>);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      exitSpy.mockRestore();
    });
  });

  describe('builder', () => {
    let mockYargs: Argv;

    beforeEach(() => {
      mockYargs = {
        options: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
        example: jest.fn().mockReturnThis(),
        conflicts: jest.fn().mockReturnThis(),
        argv: { _: ['app', 'migrate'] },
      } as unknown as Argv;
    });

    it('should add required options', async () => {
      await migrateCommand.builder(mockYargs);

      expect(mockYargs.options).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.objectContaining({
            type: 'string',
            describe: expect.any(String),
          }),
          dest: expect.objectContaining({
            type: 'string',
            describe: expect.any(String),
          }),
          'app-id': expect.objectContaining({
            type: 'number',
            describe: expect.any(String),
          }),
          'platform-version': expect.objectContaining({
            type: 'string',
            default: '2023.2',
            hidden: true,
          }),
        })
      );
    });

    it('should set default platform version to 2023.2', async () => {
      await migrateCommand.builder(mockYargs);

      expect(mockYargs.options).toHaveBeenCalledWith(
        expect.objectContaining({
          'platform-version': expect.objectContaining({
            default: '2023.2',
          }),
        })
      );
    });

    it('should add example command', async () => {
      await migrateCommand.builder(mockYargs);

      expect(mockYargs.example).toHaveBeenCalledWith([
        ['$0 app migrate', expect.any(String)],
      ]);
    });
  });
});
