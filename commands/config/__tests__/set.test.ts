import yargs, { Argv } from 'yargs';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import configSetCommand from '../set.js';
import {
  setDefaultCmsPublishMode,
  setHttpTimeout,
  setAllowUsageTracking,
  setAllowAutoUpdates,
  setAutoOpenBrowser,
} from '../../../lib/configOptions.js';
import { promptUser } from '../../../lib/prompts/promptUtils.js';
import {
  trackCommandUsage,
  trackCommandMetadataUsage,
} from '../../../lib/usageTracking.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

vi.mock('../../../lib/configOptions.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/config');

const mockSetDefaultCmsPublishMode = vi.mocked(setDefaultCmsPublishMode);
const mockSetHttpTimeout = vi.mocked(setHttpTimeout);
const mockSetAllowUsageTracking = vi.mocked(setAllowUsageTracking);
const mockSetAllowAutoUpdates = vi.mocked(setAllowAutoUpdates);
const mockSetAutoOpenBrowser = vi.mocked(setAutoOpenBrowser);
const mockPromptUser = vi.mocked(promptUser);
const mockLogError = vi.mocked(logError);

const optionsSpy = vi.spyOn(mockYargs, 'options');
const exampleSpy = vi.spyOn(mockYargs, 'example');
const processExitSpy = vi.spyOn(process, 'exit');

type HandlerArgs = Parameters<typeof configSetCommand.handler>[0];

const accountId = 123456;

function makeArgs(overrides: Record<string, unknown> = {}): HandlerArgs {
  return { derivedAccountId: accountId, ...overrides } as HandlerArgs;
}

describe('commands/config/set', () => {
  beforeEach(() => {
    // @ts-expect-error process.exit doesn't return, so the no-op signature won't match
    processExitSpy.mockImplementation(() => {});
    mockSetHttpTimeout.mockResolvedValue('5000');
    mockSetAllowAutoUpdates.mockResolvedValue(true);
    mockSetAllowUsageTracking.mockResolvedValue(false);
    mockSetAutoOpenBrowser.mockResolvedValue(true);
    mockSetDefaultCmsPublishMode.mockResolvedValue('draft' as CmsPublishMode);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(configSetCommand.command).toBe('set');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(configSetCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should register options and examples', () => {
      configSetCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalled();
      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    it('sets a single field and tracks one metadata event with its value', async () => {
      await configSetCommand.handler(makeArgs({ httpTimeout: '5000' }));

      expect(mockSetHttpTimeout).toHaveBeenCalledWith({
        httpTimeout: '5000',
        accountId,
      });
      expect(trackCommandMetadataUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandMetadataUsage).toHaveBeenCalledWith(
        'config-set',
        { action: 'httpTimeout:5000' },
        accountId
      );
    });

    it('tracks each field as its own metadata event', async () => {
      mockSetAllowAutoUpdates.mockResolvedValue(true);
      mockSetHttpTimeout.mockResolvedValue('4000');

      await configSetCommand.handler(
        makeArgs({ allowAutoUpdates: true, httpTimeout: '4000' })
      );

      expect(trackCommandMetadataUsage).toHaveBeenCalledTimes(2);
      expect(trackCommandMetadataUsage).toHaveBeenCalledWith(
        'config-set',
        { action: 'allowAutoUpdates:true' },
        accountId
      );
      expect(trackCommandMetadataUsage).toHaveBeenCalledWith(
        'config-set',
        { action: 'httpTimeout:4000' },
        accountId
      );
    });

    it('reflects the resolved value rather than the raw flag', async () => {
      mockSetAllowUsageTracking.mockResolvedValue(false);

      await configSetCommand.handler(makeArgs({ allowUsageTracking: false }));

      expect(trackCommandMetadataUsage).toHaveBeenCalledWith(
        'config-set',
        { action: 'allowUsageTracking:false' },
        accountId
      );
    });

    it('prompts for an option when no flags are provided', async () => {
      mockPromptUser.mockResolvedValue({
        configOption: { httpTimeout: '' },
      } as never);

      await configSetCommand.handler(makeArgs());

      expect(mockPromptUser).toHaveBeenCalledTimes(1);
      expect(mockSetHttpTimeout).toHaveBeenCalledWith({
        httpTimeout: '',
        accountId,
      });
    });

    it('logs the error and exits when a setter throws', async () => {
      const error = new Error('update failed');
      mockSetHttpTimeout.mockRejectedValue(error);

      await configSetCommand.handler(makeArgs({ httpTimeout: '5000' }));

      expect(mockLogError).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(trackCommandMetadataUsage).not.toHaveBeenCalled();
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'config-set',
        expect.objectContaining({ successful: false }),
        accountId
      );
    });
  });
});
