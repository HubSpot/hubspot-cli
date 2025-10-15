import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { uiCommandReference, uiDeprecatedTag } from '../../../lib/ui/index.js';
import { handlerGenerator } from '../../app/migrate.js';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { MigrateAppArgs } from '../../../lib/app/migrate.js';
import migrateAppCommand from '../migrateApp.js';
import { Mock } from 'vitest';

vi.mock('../../ui/logger.js');
vi.mock('../../../lang/en.js');
vi.mock('../../../lib/ui');
vi.mock('../../app/migrate');

const { v2023_2, v2025_2 } = PLATFORM_VERSIONS;

describe('commands/project/migrateApp', () => {
  const yargsMock = yargs as Argv;
  const optionsSpy = vi.spyOn(yargsMock, 'options').mockReturnValue(yargsMock);
  const exampleSpy = vi.spyOn(yargsMock, 'example').mockReturnValue(yargsMock);

  // Mock the imported functions
  const uiDeprecatedTagMock = uiDeprecatedTag as Mock;
  const uiCommandReferenceMock = uiCommandReference as Mock;
  const handlerGeneratorMock = handlerGenerator as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    uiDeprecatedTagMock.mockReturnValue('deprecated test description');
    uiCommandReferenceMock.mockReturnValue('command reference');
    handlerGeneratorMock.mockReturnValue(vi.fn().mockResolvedValue(undefined));
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
          default: v2025_2,
        }),
      });

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    let options: ArgumentsCamelCase<MigrateAppArgs>;
    const mockLocalHandler = vi.fn().mockResolvedValue(undefined);

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
