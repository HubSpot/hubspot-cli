import { uiLogger } from '../ui/logger.js';
import { createImport } from '@hubspot/local-dev-lib/api/crm';
import { ImportRequest } from '@hubspot/local-dev-lib/types/Crm';
import { getAccountConfig, getAccountId } from '@hubspot/local-dev-lib/config';
import {
  handleImportData,
  handleTargetTestAccountSelectionFlow,
} from '../importData.js';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { lib } from '../../lang/en.js';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  isDeveloperTestAccount,
  isStandardAccount,
  isAppDeveloperAccount,
} from '../accountTypes.js';
import { importDataTestAccountSelectPrompt } from '../prompts/importDataTestAccountSelectPrompt.js';

vi.mock('../ui/logger');
vi.mock('@hubspot/local-dev-lib/api/crm');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../accountTypes');
vi.mock('../prompts/importDataTestAccountSelectPrompt');

describe('lib/importData', () => {
  const mockUiLogger = vi.mocked(uiLogger);
  const mockCreateImport = vi.mocked(createImport);
  const mockGetAccountConfig = vi.mocked(getAccountConfig);
  const mockGetAccountId = vi.mocked(getAccountId);
  const mockIsDeveloperTestAccount = vi.mocked(isDeveloperTestAccount);
  const mockIsStandardAccount = vi.mocked(isStandardAccount);
  const mockIsAppDeveloperAccount = vi.mocked(isAppDeveloperAccount);
  const mockImportDataTestAccountSelectPrompt = vi.mocked(
    importDataTestAccountSelectPrompt
  );

  beforeEach(() => {
    mockUiLogger.info.mockReset();
    mockUiLogger.success.mockReset();
    mockUiLogger.error.mockReset();
    mockCreateImport.mockReset();
    mockGetAccountConfig.mockReset();
    mockGetAccountId.mockReset();
    mockIsDeveloperTestAccount.mockReset();
    mockIsStandardAccount.mockReset();
    mockIsAppDeveloperAccount.mockReset();
    mockImportDataTestAccountSelectPrompt.mockReset();
  });

  describe('handleImportData', () => {
    const targetAccountId = 123456789;
    const dataFileNames = ['test-file.json'];
    const importRequest: ImportRequest = {
      name: 'test-import',
    } as ImportRequest;

    it('should log the correct success message', async () => {
      // @ts-expect-error - mockCreateImport is not typed correctly
      mockCreateImport.mockResolvedValue({
        data: { id: '123' },
      } as HubSpotPromise);
      await handleImportData(targetAccountId, dataFileNames, importRequest);

      expect(mockUiLogger.info).toHaveBeenCalledWith(
        lib.importData.viewImportLink(
          'https://app.hubspot.com',
          targetAccountId,
          '123'
        )
      );
    });

    it('should log the correct error message', async () => {
      mockCreateImport.mockRejectedValue(new Error('test-error'));

      // weird because we catch the error, log a specific message, and then throw it again
      await expect(
        handleImportData(targetAccountId, dataFileNames, importRequest)
      ).rejects.toThrow('test-error');

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        lib.importData.errors.failedToImportData
      );
    });
  });

  describe('handleTargetTestAccountSelectionFlow', () => {
    const userProvidedAccountId = '1234';
    const derivedAccountId = 123456789;

    it('should error if the userProvidedAccountId is not the right account type', async () => {
      mockGetAccountConfig.mockReturnValue({} as CLIAccount);
      mockGetAccountId.mockReturnValue(1234);
      mockIsDeveloperTestAccount.mockReturnValue(false);

      await expect(
        handleTargetTestAccountSelectionFlow(
          derivedAccountId,
          userProvidedAccountId
        )
      ).rejects.toThrow(lib.importData.errors.notDeveloperTestAccount);
    });

    it('should error if the derivedAccountId belongs to the wrong account type', async () => {
      mockGetAccountConfig.mockReturnValue({} as CLIAccount);
      mockIsDeveloperTestAccount.mockReturnValue(false);
      mockIsStandardAccount.mockReturnValue(false);
      mockIsAppDeveloperAccount.mockReturnValue(false);

      await expect(
        handleTargetTestAccountSelectionFlow(derivedAccountId, undefined)
      ).rejects.toThrow(
        lib.importData.errors.incorrectAccountType(derivedAccountId)
      );
    });

    it('should return the derivedAccountId if it is a developer test account', async () => {
      mockGetAccountConfig.mockReturnValue({} as CLIAccount);
      mockIsDeveloperTestAccount.mockReturnValue(true);

      const result = await handleTargetTestAccountSelectionFlow(
        derivedAccountId,
        undefined
      );
      expect(result).toBe(derivedAccountId);
    });

    it('should return the result of the importDataTestAccountSelectPrompt if the derivedAccountId is a standard or app developer account', async () => {
      mockGetAccountConfig.mockReturnValue({} as CLIAccount);
      mockIsDeveloperTestAccount.mockReturnValue(false);
      mockIsStandardAccount.mockReturnValue(true);
      mockIsAppDeveloperAccount.mockReturnValue(true);
      mockImportDataTestAccountSelectPrompt.mockResolvedValue({
        selectedAccountId: 890223,
      });

      const result = await handleTargetTestAccountSelectionFlow(
        derivedAccountId,
        undefined
      );
      expect(result).toBe(890223);
    });
  });
});
