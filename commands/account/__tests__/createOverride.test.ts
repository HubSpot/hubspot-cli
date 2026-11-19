import yargs, { Argv } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import { commands } from '../../../lang/en.js';
import accountCreateOverrideCommand from '../createOverride.js';

vi.mock('@hubspot/local-dev-lib/config');

const mockedGlobalConfigFileExists = vi.mocked(
  configLib.globalConfigFileExists
);
const processExitSpy = vi.spyOn(process, 'exit');
const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/createOverride', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountCreateOverrideCommand.command).toEqual(
        'create-override [account]'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountCreateOverrideCommand.describe).toBeDefined();
    });

    it('should mark the description as deprecated', () => {
      expect(accountCreateOverrideCommand.describe).toContain('[DEPRECATED]');
    });
  });

  describe('handler', () => {
    it('should log a deprecation warning when the handler runs', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(false);
      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});

      await accountCreateOverrideCommand.handler({
        _: ['account', 'create-override'],
        exit: vi.fn(),
      } as unknown as Parameters<
        typeof accountCreateOverrideCommand.handler
      >[0]);

      expect(mockUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          commands.account.subcommands.createOverride.logs.deprecated
        )
      );
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountCreateOverrideCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith('account', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });
});
