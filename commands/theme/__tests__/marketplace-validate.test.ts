import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import * as marketplaceValidateCommand from '../marketplace-validate';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/theme/marketplace-validate', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      positional: jest.fn().mockReturnThis(),
    } as unknown as Argv;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(marketplaceValidateCommand.command).toEqual(
        'marketplace-validate <path>'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(marketplaceValidateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      marketplaceValidateCommand.builder(yargsMock);

      expect(yargsMock.positional).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith('path', {
        describe: expect.any(String),
        required: true,
        type: 'string',
      });

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
