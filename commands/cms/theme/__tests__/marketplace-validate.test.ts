import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../../lib/commonOpts.js';
import marketplaceValidateCommand from '../marketplace-validate.js';

vi.mock('../../../../lib/commonOpts');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/theme/marketplace-validate', () => {
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
      marketplaceValidateCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith('path', {
        describe: expect.any(String),
        required: true,
        type: 'string',
      });

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
