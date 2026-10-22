import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { selectAppPrompt } from '../selectAppPrompt.js';
import { listPrompt } from '../promptUtils.js';
import { debugError } from '../../errorHandlers/index.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';

vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('../promptUtils');
vi.mock('../../errorHandlers/index');

const mockedFetchPublicAppsForPortal = vi.mocked(fetchPublicAppsForPortal);
const mockedListPrompt = vi.mocked(listPrompt);
const mockedDebugError = vi.mocked(debugError);

const ACCOUNT_ID = 123;

const mockZetaApp = { id: 2, name: 'Zeta' } as unknown as PublicApp;
const mockAlphaApp = { id: 1, name: 'Alpha' } as unknown as PublicApp;

function mockFetchedApps(results?: PublicApp[]): void {
  mockedFetchPublicAppsForPortal.mockResolvedValue({
    data: { results },
  } as unknown as Awaited<ReturnType<typeof fetchPublicAppsForPortal>>);
}

describe('lib/prompts/selectAppPrompt', () => {
  describe('selectAppPrompt()', () => {
    beforeEach(() => {
      mockFetchedApps([mockZetaApp, mockAlphaApp]);
      mockedListPrompt.mockResolvedValue(mockAlphaApp);
    });

    it('should fetch the public apps for the account', async () => {
      await selectAppPrompt(ACCOUNT_ID);

      expect(mockedFetchPublicAppsForPortal).toHaveBeenCalledWith(ACCOUNT_ID);
    });

    it('should return the selected app', async () => {
      const result = await selectAppPrompt(ACCOUNT_ID);

      expect(result).toBe(mockAlphaApp);
    });

    it('should prompt with the apps sorted by name', async () => {
      await selectAppPrompt(ACCOUNT_ID);

      expect(mockedListPrompt).toHaveBeenCalledWith(
        lib.prompts.selectAppPrompt.selectAppId,
        {
          choices: [
            { name: 'Alpha (1)', value: mockAlphaApp },
            { name: 'Zeta (2)', value: mockZetaApp },
          ],
        }
      );
    });

    it('should return the matching app without prompting when the app id is valid', async () => {
      const result = await selectAppPrompt(ACCOUNT_ID, 2);

      expect(result).toBe(mockZetaApp);
      expect(mockedListPrompt).not.toHaveBeenCalled();
    });

    it('should log an error and prompt when the app id does not match an app', async () => {
      const result = await selectAppPrompt(ACCOUNT_ID, 999);

      expect(uiLogger.error).toHaveBeenCalledWith(
        lib.prompts.selectAppPrompt.errors.invalidAppId
      );
      expect(mockedListPrompt).toHaveBeenCalled();
      expect(result).toBe(mockAlphaApp);
    });

    it('should log an error and return null when the account has no apps', async () => {
      mockFetchedApps([]);

      const result = await selectAppPrompt(ACCOUNT_ID);

      expect(result).toBeNull();
      expect(uiLogger.error).toHaveBeenCalledWith(
        lib.prompts.selectAppPrompt.errors.noApps
      );
      expect(mockedListPrompt).not.toHaveBeenCalled();
    });

    it('should log an error and return null when the response has no results', async () => {
      mockFetchedApps(undefined);

      const result = await selectAppPrompt(ACCOUNT_ID);

      expect(result).toBeNull();
      expect(uiLogger.error).toHaveBeenCalledWith(
        lib.prompts.selectAppPrompt.errors.noApps
      );
    });

    it('should debug the error and return null when fetching apps fails', async () => {
      const error = new Error('fetch failed');
      mockedFetchPublicAppsForPortal.mockRejectedValue(error);

      const result = await selectAppPrompt(ACCOUNT_ID);

      expect(result).toBeNull();
      expect(mockedDebugError).toHaveBeenCalledWith(error);
      expect(uiLogger.error).toHaveBeenCalledWith(
        lib.prompts.selectAppPrompt.errors.noApps
      );
    });
  });
});
