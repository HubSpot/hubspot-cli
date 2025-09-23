import yargs, { Argv } from 'yargs';
import { addConfigOptions, addTestingOptions } from '../../lib/commonOpts.js';
import authCommand from '../auth.js';

vi.mock('../../lib/commonOpts');

const optionsSpy = vi
  .spyOn(mockYargs, 'options')
  .mockReturnValue(yargs as Argv);

describe('commands/auth', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(authCommand.command).toEqual('auth');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(authCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      authCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        'auth-type': expect.objectContaining({
          type: 'string',
          choices: ['personalaccesskey', 'oauth2'],
          default: 'personalaccesskey',
        }),
        account: expect.objectContaining({ type: 'string' }),
        'personal-access-key': expect.objectContaining({ type: 'string' }),
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
