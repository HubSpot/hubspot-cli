import {
  getAllConfigAccounts,
  getConfigDefaultAccountIfExists,
  setConfigAccountAsDefault,
} from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { setAsDefaultAccountPrompt } from '../setAsDefaultAccountPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/config');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedGetConfigDefaultAccountIfExists = vi.mocked(
  getConfigDefaultAccountIfExists
);
const mockedSetConfigAccountAsDefault = vi.mocked(setConfigAccountAsDefault);

const mockCurrentDefault = {
  name: 'current-default',
  accountId: 111,
} as unknown as HubSpotConfigAccount;
const mockOtherAccount = {
  name: 'other',
  accountId: 222,
} as unknown as HubSpotConfigAccount;

type PromptConfigs = Parameters<typeof promptUser>[0];

function getWhen(): unknown {
  const [config] = mockedPromptUser.mock.calls[0];
  const [prompt] = config as Exclude<PromptConfigs, { name: unknown }>;
  return prompt.when;
}

describe('lib/prompts/setAsDefaultAccountPrompt', () => {
  describe('setAsDefaultAccountPrompt()', () => {
    beforeEach(() => {
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(mockCurrentDefault);
      mockedGetAllConfigAccounts.mockReturnValue([
        mockCurrentDefault,
        mockOtherAccount,
      ]);
      mockedPromptUser.mockResolvedValue({ setAsDefault: false });
    });

    it('should prompt with a confirm that defaults to false', async () => {
      await setAsDefaultAccountPrompt('other');

      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          name: 'setAsDefault',
          type: 'confirm',
          when: true,
          message:
            lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccountMessage(
              'other'
            ),
          default: false,
        },
      ]);
    });

    it('should not prompt when the account is already the default', async () => {
      await setAsDefaultAccountPrompt('current-default');

      expect(getWhen()).toBe(false);
    });

    it('should not prompt when there are no accounts in the config', async () => {
      mockedGetAllConfigAccounts.mockReturnValue(
        undefined as unknown as HubSpotConfigAccount[]
      );

      await setAsDefaultAccountPrompt('other');

      expect(getWhen()).toBe(false);
    });

    it('should set the account as the default and log success when the user confirms', async () => {
      mockedPromptUser.mockResolvedValue({ setAsDefault: true });

      const result = await setAsDefaultAccountPrompt('other');

      expect(result).toBe(true);
      expect(mockedSetConfigAccountAsDefault).toHaveBeenCalledWith('other');
      expect(uiLogger.success).toHaveBeenCalledWith(
        lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount('other')
      );
    });

    it('should log that the current default is kept when the user declines', async () => {
      const result = await setAsDefaultAccountPrompt('other');

      expect(result).toBe(false);
      expect(mockedSetConfigAccountAsDefault).not.toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault(
          'current-default'
        )
      );
    });

    it('should not log the current default when there is none and the user declines', async () => {
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

      await setAsDefaultAccountPrompt('other');

      expect(uiLogger.log).toHaveBeenCalledTimes(1);
      expect(uiLogger.log).toHaveBeenCalledWith('');
    });
  });
});
