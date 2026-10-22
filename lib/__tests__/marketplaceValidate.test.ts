import {
  requestValidation,
  getValidationStatus,
  getValidationResults,
} from '@hubspot/local-dev-lib/api/marketplaceValidation';
import { GetValidationResultsResponse } from '@hubspot/local-dev-lib/types/MarketplaceValidation';
import { uiLogger } from '../ui/logger.js';
import {
  displayValidationResults,
  fetchValidationResults,
  hasProcessValidationErrors,
  kickOffValidation,
  pollForValidationFinish,
} from '../marketplaceValidate.js';

vi.mock('@hubspot/local-dev-lib/api/marketplaceValidation');

const mockedRequestValidation = vi.mocked(requestValidation);
const mockedGetValidationStatus = vi.mocked(getValidationStatus);
const mockedGetValidationResults = vi.mocked(getValidationResults);
const mockedUiLogger = vi.mocked(uiLogger);

const ACCOUNT_ID = 123;
const VALIDATION_ID = 456;
const POLL_DELAY = 2000;

const mockResultsCopy = {
  noErrors: 'No errors',
  required: 'Required',
  recommended: 'Recommended',
  warnings: {
    file: (file: string) => `file: ${file}`,
    lineNumber: (line: string) => `line: ${line}`,
  },
};

function buildValidationResults(
  overrides: Record<string, unknown> = {}
): GetValidationResultsResponse {
  return {
    assetPath: 'my/theme',
    errors: [],
    results: {},
    ...overrides,
  } as unknown as GetValidationResultsResponse;
}

function mockStatus(status: string): void {
  mockedGetValidationStatus.mockResolvedValueOnce({
    data: status,
  } as unknown as Awaited<ReturnType<typeof getValidationStatus>>);
}

describe('lib/marketplaceValidate', () => {
  describe('kickOffValidation()', () => {
    it('should request validation and return the validation id', async () => {
      mockedRequestValidation.mockResolvedValue({
        data: VALIDATION_ID,
      } as unknown as Awaited<ReturnType<typeof requestValidation>>);

      const result = await kickOffValidation(ACCOUNT_ID, 'THEME', 'my/theme');

      expect(result).toBe(VALIDATION_ID);
      expect(mockedRequestValidation).toHaveBeenCalledWith(ACCOUNT_ID, {
        path: 'my/theme',
        assetType: 'THEME',
        requestGroup: 'EXTERNAL_DEVELOPER',
      });
    });

    it('should reject when the request fails', async () => {
      mockedRequestValidation.mockRejectedValue(new Error('boom'));

      await expect(
        kickOffValidation(ACCOUNT_ID, 'THEME', 'my/theme')
      ).rejects.toThrow('boom');
    });
  });

  describe('pollForValidationFinish()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve immediately when the status is not REQUESTED', async () => {
      mockStatus('DONE');

      await pollForValidationFinish(ACCOUNT_ID, VALIDATION_ID);

      expect(mockedGetValidationStatus).toHaveBeenCalledTimes(1);
      expect(mockedGetValidationStatus).toHaveBeenCalledWith(ACCOUNT_ID, {
        validationId: VALIDATION_ID,
      });
    });

    it('should keep polling while the status is REQUESTED', async () => {
      mockStatus('REQUESTED');
      mockStatus('REQUESTED');
      mockStatus('DONE');

      const pollPromise = pollForValidationFinish(ACCOUNT_ID, VALIDATION_ID);
      await vi.advanceTimersByTimeAsync(POLL_DELAY * 2);
      await pollPromise;

      expect(mockedGetValidationStatus).toHaveBeenCalledTimes(3);
    });

    it('should wait between polls', async () => {
      mockStatus('REQUESTED');
      mockStatus('DONE');

      const pollPromise = pollForValidationFinish(ACCOUNT_ID, VALIDATION_ID);
      await vi.advanceTimersByTimeAsync(POLL_DELAY - 1);

      expect(mockedGetValidationStatus).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await pollPromise;

      expect(mockedGetValidationStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchValidationResults()', () => {
    it('should return the validation results', async () => {
      const results = buildValidationResults();
      mockedGetValidationResults.mockResolvedValue({
        data: results,
      } as unknown as Awaited<ReturnType<typeof getValidationResults>>);

      const result = await fetchValidationResults(ACCOUNT_ID, VALIDATION_ID);

      expect(result).toBe(results);
      expect(mockedGetValidationResults).toHaveBeenCalledWith(ACCOUNT_ID, {
        validationId: VALIDATION_ID,
      });
    });
  });

  describe('hasProcessValidationErrors()', () => {
    const invalidPathError = (assetPath: string): string =>
      `invalid path ${assetPath}`;

    it('should return false and log nothing when there are no errors', () => {
      const result = hasProcessValidationErrors(
        invalidPathError,
        buildValidationResults()
      );

      expect(result).toBe(false);
      expect(mockedUiLogger.error).not.toHaveBeenCalled();
    });

    it('should log the invalid path error for DOWNLOAD_EMPTY errors', () => {
      const result = hasProcessValidationErrors(
        invalidPathError,
        buildValidationResults({
          errors: [
            { failureReasonType: 'DOWNLOAD_EMPTY', context: 'ignored context' },
          ],
        })
      );

      expect(result).toBe(true);
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        'invalid path my/theme'
      );
      expect(mockedUiLogger.error).not.toHaveBeenCalledWith('ignored context');
    });

    it('should log the error context for other errors', () => {
      const result = hasProcessValidationErrors(
        invalidPathError,
        buildValidationResults({
          errors: [
            { failureReasonType: 'OTHER', context: 'first' },
            { failureReasonType: 'ANOTHER', context: 'second' },
          ],
        })
      );

      expect(result).toBe(true);
      expect(mockedUiLogger.error).toHaveBeenCalledWith('first');
      expect(mockedUiLogger.error).toHaveBeenCalledWith('second');
    });
  });

  describe('displayValidationResults()', () => {
    it('should log nothing when there are no result types', () => {
      displayValidationResults(mockResultsCopy, buildValidationResults());

      expect(mockedUiLogger.log).not.toHaveBeenCalled();
    });

    it('should log a section title and a trailing blank line for each result type', () => {
      displayValidationResults(
        mockResultsCopy,
        buildValidationResults({
          results: {
            REQUIRED: { status: 'PASS', results: [] },
          },
        })
      );

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Required')
      );
      expect(mockedUiLogger.log).toHaveBeenLastCalledWith('');
    });

    it('should log the no errors message when a section passes', () => {
      displayValidationResults(
        mockResultsCopy,
        buildValidationResults({
          results: {
            REQUIRED: { status: 'PASS', results: [] },
          },
        })
      );

      expect(mockedUiLogger.success).toHaveBeenCalledWith('No errors');
    });

    it('should log warnings for a passing section with warn results', () => {
      displayValidationResults(
        mockResultsCopy,
        buildValidationResults({
          results: {
            RECOMMENDED: {
              status: 'PASS',
              results: [
                {
                  status: 'WARN',
                  message: 'be careful',
                  file: 'a.html',
                  line: 7,
                },
                { status: 'PASS', message: 'fine', file: 'b.html', line: 1 },
              ],
            },
          },
        })
      );

      expect(mockedUiLogger.warn).toHaveBeenCalledWith('be careful');
      expect(mockedUiLogger.warn).not.toHaveBeenCalledWith('fine');
      expect(mockedUiLogger.log).toHaveBeenCalledWith('file: a.html');
      expect(mockedUiLogger.log).toHaveBeenCalledWith('line: 7');
    });

    it('should log failures as errors and warnings as warnings for a failing section', () => {
      displayValidationResults(
        mockResultsCopy,
        buildValidationResults({
          results: {
            REQUIRED: {
              status: 'FAIL',
              results: [
                {
                  status: 'FAIL',
                  message: 'broken',
                  file: 'a.html',
                  line: 3,
                },
                {
                  status: 'WARN',
                  message: 'suspicious',
                  file: 'b.html',
                  line: null,
                },
                { status: 'PASS', message: 'fine', file: 'c.html', line: 1 },
              ],
            },
          },
        })
      );

      expect(mockedUiLogger.error).toHaveBeenCalledWith('broken');
      expect(mockedUiLogger.warn).toHaveBeenCalledWith('suspicious');
      expect(mockedUiLogger.success).not.toHaveBeenCalled();
      expect(mockedUiLogger.error).not.toHaveBeenCalledWith('fine');
      expect(mockedUiLogger.warn).not.toHaveBeenCalledWith('fine');
    });

    it('should omit the line number when a result has no line', () => {
      displayValidationResults(
        mockResultsCopy,
        buildValidationResults({
          results: {
            REQUIRED: {
              status: 'FAIL',
              results: [
                {
                  status: 'FAIL',
                  message: 'broken',
                  file: 'a.html',
                  line: null,
                },
              ],
            },
          },
        })
      );

      expect(mockedUiLogger.log).toHaveBeenCalledWith('file: a.html');
      expect(mockedUiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('line:')
      );
    });
  });
});
