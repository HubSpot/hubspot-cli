import fs from 'fs';
import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';
import { isValidPath, untildify } from '@hubspot/local-dev-lib/path';
import { Table } from '@hubspot/local-dev-lib/types/Hubdb';
import { selectHubDBTablePrompt } from '../selectHubDBTablePrompt.js';
import { promptUser } from '../promptUtils.js';
import { debugError } from '../../errorHandlers/index.js';
import { uiLogger } from '../../ui/logger.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { lib } from '../../../lang/en.js';

vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/api/hubdb');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('../promptUtils');
vi.mock('../../errorHandlers/index');

const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedFetchTables = vi.mocked(fetchTables);
const mockedIsValidPath = vi.mocked(isValidPath);
const mockedUntildify = vi.mocked(untildify);
const mockedPromptUser = vi.mocked(promptUser);
const mockedDebugError = vi.mocked(debugError);

const ACCOUNT_ID = 123;

const mockTables = [
  { id: '1', label: 'Table One' },
  { id: '2', label: 'Table Two' },
] as unknown as Table[];

type PromptConfigs = Exclude<
  Parameters<typeof promptUser>[0],
  { name: unknown }
>;
type ValidateFn = (input?: string) => unknown;
type FilterFn = (input: string) => string;

function mockFetchedTables(tables: Table[]): void {
  mockedFetchTables.mockResolvedValue({
    data: { results: tables },
  } as unknown as Awaited<ReturnType<typeof fetchTables>>);
}

function getPromptConfigs(): PromptConfigs {
  return mockedPromptUser.mock.calls[0][0] as PromptConfigs;
}

describe('lib/prompts/selectHubDBTablePrompt', () => {
  describe('selectHubDBTablePrompt()', () => {
    beforeEach(() => {
      mockFetchedTables(mockTables);
      mockedPromptUser.mockResolvedValue({ tableId: '1' });
      mockedExistsSync.mockReturnValue(false);
      mockedIsValidPath.mockReturnValue(true);
      mockedUntildify.mockImplementation(input => input);
    });

    it('should fetch the tables for the account', async () => {
      await selectHubDBTablePrompt({ accountId: ACCOUNT_ID, options: {} });

      expect(mockedFetchTables).toHaveBeenCalledWith(ACCOUNT_ID);
    });

    it('should return the prompt response', async () => {
      const result = await selectHubDBTablePrompt({
        accountId: ACCOUNT_ID,
        options: {},
      });

      expect(result).toEqual({ tableId: '1' });
    });

    it('should prompt with the tables as choices', async () => {
      await selectHubDBTablePrompt({ accountId: ACCOUNT_ID, options: {} });

      expect(getPromptConfigs()[0]).toEqual({
        name: 'tableId',
        message: lib.prompts.selectHubDBTablePrompt.selectTable,
        when: true,
        type: 'list',
        choices: [
          { name: 'Table One (1)', value: '1' },
          { name: 'Table Two (2)', value: '2' },
        ],
      });
    });

    it('should skip the table prompt when a table id option is provided', async () => {
      await selectHubDBTablePrompt({
        accountId: ACCOUNT_ID,
        options: { tableId: 2 },
      });

      expect(getPromptConfigs()[0]).toEqual(
        expect.objectContaining({ name: 'tableId', when: false })
      );
    });

    it('should skip the table prompt when the table id option does not match a fetched table', async () => {
      await selectHubDBTablePrompt({
        accountId: ACCOUNT_ID,
        options: { tableId: 999 },
      });

      expect(getPromptConfigs()[0]).toEqual(
        expect.objectContaining({ name: 'tableId', when: false })
      );
    });

    it('should skip the dest prompt by default', async () => {
      await selectHubDBTablePrompt({ accountId: ACCOUNT_ID, options: {} });

      expect(getPromptConfigs()[1]).toEqual(
        expect.objectContaining({ name: 'dest', when: false })
      );
    });

    it('should prompt for dest when skipDestPrompt is false', async () => {
      await selectHubDBTablePrompt({
        accountId: ACCOUNT_ID,
        options: {},
        skipDestPrompt: false,
      });

      expect(getPromptConfigs()[1]).toEqual(
        expect.objectContaining({
          name: 'dest',
          message: lib.prompts.selectHubDBTablePrompt.enterDest,
          when: true,
        })
      );
    });

    it('should skip the dest prompt when a dest option is provided', async () => {
      await selectHubDBTablePrompt({
        accountId: ACCOUNT_ID,
        options: { dest: 'given' },
        skipDestPrompt: false,
      });

      expect(getPromptConfigs()[1]).toEqual(
        expect.objectContaining({ name: 'dest', when: false })
      );
    });

    describe('dest validate', () => {
      async function getDestValidate(): Promise<ValidateFn> {
        await selectHubDBTablePrompt({
          accountId: ACCOUNT_ID,
          options: {},
          skipDestPrompt: false,
        });
        return getPromptConfigs()[1].validate as ValidateFn;
      }

      it('should return the dest required error when the input is empty', async () => {
        const validate = await getDestValidate();

        expect(validate('')).toBe(
          lib.prompts.selectHubDBTablePrompt.errors.destRequired
        );
      });

      it('should return the invalid dest error when the destination already exists', async () => {
        mockedExistsSync.mockReturnValue(true);
        const validate = await getDestValidate();

        expect(validate('existing')).toBe(
          lib.prompts.selectHubDBTablePrompt.errors.invalidDest
        );
      });

      it('should return the invalid characters error when the path is not valid', async () => {
        mockedIsValidPath.mockReturnValue(false);
        const validate = await getDestValidate();

        expect(validate('bad<>path')).toBe(
          lib.prompts.selectHubDBTablePrompt.errors.invalidCharacters
        );
      });

      it('should return true when the destination is valid', async () => {
        const validate = await getDestValidate();

        expect(validate('new-dest')).toBe(true);
      });
    });

    describe('dest filter', () => {
      it('should untildify the input', async () => {
        mockedUntildify.mockReturnValue('/home/user/expanded');
        await selectHubDBTablePrompt({
          accountId: ACCOUNT_ID,
          options: {},
          skipDestPrompt: false,
        });

        const filter = getPromptConfigs()[1].filter as FilterFn;

        expect(filter('~/expanded')).toBe('/home/user/expanded');
      });
    });

    describe('when there are no tables', () => {
      beforeEach(() => {
        mockFetchedTables([]);
      });

      it('should throw a PromptExitError with a success code', async () => {
        const promise = selectHubDBTablePrompt({
          accountId: ACCOUNT_ID,
          options: {},
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message: lib.prompts.selectHubDBTablePrompt.errors.noTables('123'),
          exitCode: EXIT_CODES.SUCCESS,
        });
      });

      it('should log that no tables were found and not prompt', async () => {
        await expect(
          selectHubDBTablePrompt({ accountId: ACCOUNT_ID, options: {} })
        ).rejects.toThrow(PromptExitError);

        expect(uiLogger.log).toHaveBeenCalledWith(
          lib.prompts.selectHubDBTablePrompt.errors.noTables('123')
        );
        expect(mockedPromptUser).not.toHaveBeenCalled();
      });
    });

    describe('when fetching tables fails', () => {
      const error = new Error('fetch failed');

      beforeEach(() => {
        mockedFetchTables.mockRejectedValue(error);
      });

      it('should throw a PromptExitError with an error code', async () => {
        const promise = selectHubDBTablePrompt({
          accountId: ACCOUNT_ID,
          options: {},
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message:
            lib.prompts.selectHubDBTablePrompt.errors.errorFetchingTables(
              '123'
            ),
          exitCode: EXIT_CODES.ERROR,
        });
      });

      it('should debug the error and log an error message', async () => {
        await expect(
          selectHubDBTablePrompt({ accountId: ACCOUNT_ID, options: {} })
        ).rejects.toThrow(PromptExitError);

        expect(mockedDebugError).toHaveBeenCalledWith(error, {
          accountId: ACCOUNT_ID,
        });
        expect(uiLogger.error).toHaveBeenCalledWith(
          lib.prompts.selectHubDBTablePrompt.errors.errorFetchingTables('123')
        );
      });
    });
  });
});
