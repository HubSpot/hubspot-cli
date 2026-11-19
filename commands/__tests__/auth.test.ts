import yargs, { Argv } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import { addConfigOptions, addTestingOptions } from '../../lib/commonOpts.js';
import { commands } from '../../lang/en.js';
import authCommand from '../auth.js';

vi.mock('../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../lib/usageTracking.js');

const optionsSpy = vi
  .spyOn(mockYargs, 'options')
  .mockReturnValue(yargs as Argv);
const mockedGlobalConfigFileExists = vi.mocked(
  configLib.globalConfigFileExists
);
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/auth', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    mockedGlobalConfigFileExists.mockReturnValue(false);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(authCommand.command).toEqual('auth');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(authCommand.describe).toBeDefined();
    });

    it('should mark the description as deprecated', () => {
      expect(authCommand.describe).toContain('[DEPRECATED]');
    });
  });

  describe('handler', () => {
    it('should log a deprecation warning when the handler runs', async () => {
      await authCommand.handler({
        _: ['auth'],
        authType: 'unsupported',
        disableTracking: false,
        exit: vi.fn(),
      } as unknown as Parameters<typeof authCommand.handler>[0]);

      expect(mockUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(commands.auth.logs.deprecated)
      );
    });

    it('should not log a deprecation warning when global config exists', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);

      await authCommand.handler({
        _: ['auth'],
        authType: 'unsupported',
        disableTracking: false,
        exit: vi.fn(),
      } as unknown as Parameters<typeof authCommand.handler>[0]);

      expect(mockUiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining(commands.auth.logs.deprecated)
      );
      expect(mockUiLogger.error).toHaveBeenCalled();
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
