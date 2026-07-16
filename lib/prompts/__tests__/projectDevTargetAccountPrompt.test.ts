import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectDeveloperTestTargetAccountPrompt } from '../projectDevTargetAccountPrompt.js';
import * as developerTestAccountsApi from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import * as promptUtils from '../promptUtils.js';
import { lib } from '../../../lang/en.js';
import { PromptExitError } from '../../errors/PromptExitError.js';

vi.mock('@hubspot/local-dev-lib/api/developerTestAccounts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../promptUtils.js');

const mockFetchDeveloperTestAccounts = vi.mocked(
  developerTestAccountsApi.fetchDeveloperTestAccounts
);
const mockPromptUser = vi.mocked(promptUtils.promptUser);

const defaultAccountConfig = {
  accountId: 123,
  name: 'Test Account',
  authType: 'personalaccesskey',
} as HubSpotConfigAccount;

const makeResponse = (resultCount: number, maxTestPortals: number) =>
  ({
    data: {
      results: Array.from({ length: resultCount }, (_, i) => ({
        id: i + 1,
        accountName: `Dev Test ${i + 1}`,
      })),
      maxTestPortals,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('selectDeveloperTestTargetAccountPrompt', () => {
  beforeEach(() => {
    mockPromptUser.mockResolvedValue({
      targetAccountInfo: {
        targetAccountId: 1,
        createNestedAccount: false,
      },
    });
  });

  describe('when accountId is missing', () => {
    it('should throw a PromptExitError and log the error', async () => {
      const noIdConfig = {
        ...defaultAccountConfig,
        accountId: undefined,
      } as unknown as HubSpotConfigAccount;

      await expect(
        selectDeveloperTestTargetAccountPrompt([], noIdConfig)
      ).rejects.toThrow(PromptExitError);

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        lib.prompts.projectDevTargetAccountPrompt.noAccountId
      );
    });
  });

  describe('when fetchDeveloperTestAccounts throws', () => {
    it('should throw a PromptExitError and log the error', async () => {
      mockFetchDeveloperTestAccounts.mockRejectedValue(
        new Error('network error')
      );

      await expect(
        selectDeveloperTestTargetAccountPrompt([], defaultAccountConfig)
      ).rejects.toThrow(PromptExitError);

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        lib.prompts.projectDevTargetAccountPrompt
          .fetchDeveloperTestAccountsError
      );
    });

    it('should not call promptUser when the fetch fails', async () => {
      mockFetchDeveloperTestAccounts.mockRejectedValue(
        new Error('network error')
      );

      await expect(
        selectDeveloperTestTargetAccountPrompt([], defaultAccountConfig)
      ).rejects.toThrow();

      expect(mockPromptUser).not.toHaveBeenCalled();
    });
  });

  describe('when fetchDeveloperTestAccounts succeeds', () => {
    it('should enable the create option when under the limit', async () => {
      mockFetchDeveloperTestAccounts.mockResolvedValue(makeResponse(1, 3));

      await selectDeveloperTestTargetAccountPrompt([], defaultAccountConfig);

      const questions = mockPromptUser.mock.calls[0][0] as Array<{
        name: string;
        choices: Array<{ name: string; disabled: string | boolean }>;
      }>;
      const createOption = questions[0].choices.find(
        c =>
          c.name ===
          lib.prompts.projectDevTargetAccountPrompt
            .createNewDeveloperTestAccountOption
      );

      expect(createOption?.disabled).toBe(false);
    });

    it('should disable the create option when at the limit', async () => {
      mockFetchDeveloperTestAccounts.mockResolvedValue(makeResponse(3, 3));

      await selectDeveloperTestTargetAccountPrompt([], defaultAccountConfig);

      const questions = mockPromptUser.mock.calls[0][0] as Array<{
        name: string;
        choices: Array<{ name: string; disabled: string | boolean }>;
      }>;
      const createOption = questions[0].choices.find(
        c =>
          c.name ===
          lib.prompts.projectDevTargetAccountPrompt
            .createNewDeveloperTestAccountOption
      );

      expect(createOption?.disabled).toBe(
        lib.prompts.projectDevTargetAccountPrompt.developerTestAccountLimit(3)
      );
    });
  });
});
