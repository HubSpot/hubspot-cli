import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
} from '../../../lib/commonOpts.js';
import accountRenameCommand, { AccountRenameArgs } from '../rename.js';
import * as config from '@hubspot/local-dev-lib/config';
import { logError } from '../../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/errorHandlers/index.js');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const renameAccountSpy = vi.spyOn(config, 'renameAccount');
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/account/rename', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountRenameCommand.command).toEqual(
        'rename <account-name> <new-name>'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountRenameCommand.describe).toBeDefined();
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<AccountRenameArgs>;

    beforeEach(() => {
      vi.clearAllMocks();
      renameAccountSpy.mockResolvedValue(undefined);
      processExitSpy.mockImplementation(() => {
        throw new Error('process.exit called');
      });
      args = {
        accountName: 'myExistingAccountName',
        newName: 'myNewAccountName',
      } as ArgumentsCamelCase<AccountRenameArgs>;
    });

    it('should rename the account', async () => {
      await expect(accountRenameCommand.handler(args)).rejects.toThrow(
        'process.exit called'
      );
      expect(renameAccountSpy).toHaveBeenCalledWith(
        'myExistingAccountName',
        'my-new-account-name'
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle errors when renameAccount throws', async () => {
      const error = new Error('Failed to rename account');
      renameAccountSpy.mockRejectedValue(error);

      await expect(accountRenameCommand.handler(args)).rejects.toThrow(
        'process.exit called'
      );

      expect(renameAccountSpy).toHaveBeenCalledWith(
        'myExistingAccountName',
        'my-new-account-name'
      );
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountRenameCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledTimes(2);
      expect(positionalSpy).toHaveBeenCalledWith('account-name', {
        describe: expect.any(String),
        type: 'string',
      });
      expect(positionalSpy).toHaveBeenCalledWith('new-name', {
        describe: expect.any(String),
        type: 'string',
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
