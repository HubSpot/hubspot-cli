import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addOverwriteOptions,
  addCmsPublishModeOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';

vi.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import fetchCommand from '../fetch.js';

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

describe('commands/cms/fetch', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fetchCommand.command).toEqual('fetch <src> [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fetchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      fetchCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(2);
      expect(positionalSpy).toHaveBeenCalledWith(
        'src',
        expect.objectContaining({ type: 'string' })
      );
      expect(positionalSpy).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      fetchCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(2);
      expect(optionsSpy).toHaveBeenCalledWith({
        staging: expect.objectContaining({
          type: 'boolean',
          default: false,
          hidden: true,
        }),
      });
      expect(optionsSpy).toHaveBeenCalledWith({
        assetVersion: expect.objectContaining({ type: 'number' }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addOverwriteOptions).toHaveBeenCalledTimes(1);
      expect(addOverwriteOptions).toHaveBeenCalledWith(yargs);

      expect(addCmsPublishModeOptions).toHaveBeenCalledTimes(1);
      expect(addCmsPublishModeOptions).toHaveBeenCalledWith(yargs, {
        read: true,
      });

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
