import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';
import { uiLogger } from '../../../lib/ui/logger.js';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { migrateApp, MigrateAppArgs } from '../../../lib/app/migrate.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import migrateCommand from '../migrate.js';
import { Mock, Mocked } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/app/migrate');
vi.mock('../../../lib/projects/config.js');
const mockYargs = yargs as Argv;

const mockedGetConfigAccountById = getConfigAccountById as Mock;
const mockedmigrateApp = migrateApp as Mock;
const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;
const optionsSpy = vi.spyOn(mockYargs, 'options');
const exampleSpy = vi.spyOn(mockYargs, 'example');

const exitSpy = vi
  .spyOn(process, 'exit')
  .mockImplementation(() => undefined as never);

describe('commands/app/migrate', () => {
  const mockAccountId = 123;
  const mockAccountConfig = {
    accountId: mockAccountId,
    name: 'Test Account',
    env: 'prod',
    authType: 'personalaccesskey',
    personalAccessKey: 'test-key',
  };

  beforeEach(() => {
    mockedGetConfigAccountById.mockReturnValue(mockAccountConfig);
    exitSpy.mockClear();
  });

  afterEach(() => {
    exitSpy.mockClear();
  });

  describe('handler', () => {
    it('should exit with error when no account config is found', async () => {
      mockedGetConfigAccountById.mockReturnValue(null);

      await migrateCommand.handler({
        derivedAccountId: mockAccountId,
      } as ArgumentsCamelCase<MigrateAppArgs>);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should call migrateApp for platform version 2025.2', async () => {
      const options = {
        derivedAccountId: mockAccountId,
        platformVersion: PLATFORM_VERSIONS.v2025_2,
      } as ArgumentsCamelCase<MigrateAppArgs>;

      await migrateCommand.handler(options);

      expect(mockedmigrateApp).toHaveBeenCalledWith(mockAccountId, options);
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should call migrateApp when unstable is true', async () => {
      const options = {
        derivedAccountId: mockAccountId,
        unstable: true,
      } as ArgumentsCamelCase<MigrateAppArgs>;

      await migrateCommand.handler(options);

      expect(mockedmigrateApp).toHaveBeenCalledWith(mockAccountId, options);
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle errors during migration', async () => {
      const mockError = new Error('Migration failed');
      mockedmigrateApp.mockRejectedValue(mockError);

      await migrateCommand.handler({
        derivedAccountId: mockAccountId,
        platformVersion: PLATFORM_VERSIONS.v2025_2,
      } as ArgumentsCamelCase<MigrateAppArgs>);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });

  describe('builder', () => {
    it('should add required options', async () => {
      await migrateCommand.builder(mockYargs);

      expect(optionsSpy).toHaveBeenCalledWith(
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
            default: '2026.03',
          }),
        })
      );
    });

    it('should set default platform version to 2025.2', async () => {
      await migrateCommand.builder(mockYargs);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          'platform-version': expect.objectContaining({
            default: '2026.03',
          }),
        })
      );
    });

    it('should add example command', async () => {
      await migrateCommand.builder(mockYargs);

      expect(exampleSpy).toHaveBeenCalledWith([
        ['$0 app migrate', expect.any(String)],
      ]);
    });
  });
});
