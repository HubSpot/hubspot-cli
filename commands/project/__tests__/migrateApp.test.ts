import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { i18n } from '../../../lib/lang';
import { uiCommandReference, uiDeprecatedTag } from '../../../lib/ui';
import { handlerGenerator } from '../../app/migrate';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { MigrateAppArgs } from '../../../lib/app/migrate';
import migrateAppCommand from '../migrateApp';

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../../lib/lang');
jest.mock('../../../lib/ui');
jest.mock('../../app/migrate');

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;

describe('commands/project/migrateApp', () => {
  const yargsMock = yargs as Argv;
  const optionsSpy = jest
    .spyOn(yargsMock, 'options')
    .mockReturnValue(yargsMock);
  const exampleSpy = jest
    .spyOn(yargsMock, 'example')
    .mockReturnValue(yargsMock);

  // Mock the imported functions
  const i18nMock = i18n as jest.Mock;
  const uiDeprecatedTagMock = uiDeprecatedTag as jest.Mock;
  const uiCommandReferenceMock = uiCommandReference as jest.Mock;
  const handlerGeneratorMock = handlerGenerator as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    i18nMock.mockReturnValue('test description');
    uiDeprecatedTagMock.mockReturnValue('deprecated test description');
    uiCommandReferenceMock.mockReturnValue('command reference');
    handlerGeneratorMock.mockReturnValue(
      jest.fn().mockResolvedValue(undefined)
    );
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(migrateAppCommand.command).toEqual('migrate-app');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(migrateAppCommand.describe).toBe(undefined);
    });

    it('should be marked as deprecated', () => {
      expect(migrateAppCommand.deprecated).toBe(true);
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      migrateAppCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith({
        name: expect.objectContaining({
          describe: expect.any(String),
          type: 'string',
        }),
        dest: expect.objectContaining({
          describe: expect.any(String),
          type: 'string',
        }),
        'app-id': expect.objectContaining({
          describe: expect.any(String),
          type: 'number',
        }),
        'platform-version': expect.objectContaining({
          type: 'string',
          choices: [v2023_2, v2025_2],
          hidden: true,
          default: v2023_2,
        }),
      });

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    let options: ArgumentsCamelCase<MigrateAppArgs>;
    const mockLocalHandler = jest.fn().mockResolvedValue(undefined);

    beforeEach(() => {
      options = {
        platformVersion: v2023_2,
      } as ArgumentsCamelCase<MigrateAppArgs>;

      handlerGeneratorMock.mockReturnValue(mockLocalHandler);
    });

    it('should call the local handler with the provided options', async () => {
      await migrateAppCommand.handler(options);

      expect(handlerGeneratorMock).toHaveBeenCalledWith('migrate-app');
      expect(mockLocalHandler).toHaveBeenCalledWith(options);
    });
  });
});
