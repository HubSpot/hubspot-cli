import yargs, { Argv } from 'yargs';
import { addConfigOptions, addTestingOptions } from '../../lib/commonOpts';
import initCommand from '../init';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

const optionsSpy = jest
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

describe('commands/init', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(initCommand.command).toEqual('init');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(initCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      initCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        'auth-type': expect.objectContaining({
          type: 'string',
          choices: ['personalaccesskey', 'oauth2'],
          default: 'personalaccesskey',
        }),
        account: expect.objectContaining({ type: 'string' }),
        'disable-tracking': expect.objectContaining({
          type: 'boolean',
          hidden: true,
          default: false,
        }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
