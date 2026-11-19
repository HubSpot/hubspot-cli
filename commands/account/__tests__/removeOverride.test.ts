import yargs, { Argv } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import { commands } from '../../../lang/en.js';
import accountRemoveOverrideCommand from '../removeOverride.js';

vi.mock('@hubspot/local-dev-lib/config');

const mockedGlobalConfigFileExists = vi.mocked(
  configLib.globalConfigFileExists
);
const processExitSpy = vi.spyOn(process, 'exit');
const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

describe('commands/account/removeOverride', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    mockedGlobalConfigFileExists.mockReturnValue(false);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountRemoveOverrideCommand.command).toEqual('remove-override');
    });
  });

  describe('describe', () => {
    it('should mark the description as deprecated', () => {
      expect(accountRemoveOverrideCommand.describe).toContain('[DEPRECATED]');
    });
  });

  describe('handler', () => {
    it('should log a deprecation warning when the handler runs', async () => {
      await accountRemoveOverrideCommand.handler({
        _: ['account', 'remove-override'],
        exit: vi.fn(),
      } as unknown as Parameters<
        typeof accountRemoveOverrideCommand.handler
      >[0]);

      expect(mockUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          commands.account.subcommands.removeOverride.logs.deprecated
        )
      );
    });
  });

  describe('builder', () => {
    it('should support the force option', () => {
      accountRemoveOverrideCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledWith('force', {
        describe: expect.any(String),
        type: 'boolean',
      });
    });
  });
});
