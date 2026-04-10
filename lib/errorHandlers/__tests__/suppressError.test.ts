import { Mock } from 'vitest';
import { shouldSuppressError } from '../suppressError.js';
import { uiLogger } from '../../ui/logger.js';
import {
  isSpecifiedError,
  isMissingScopeError,
} from '@hubspot/local-dev-lib/errors/index';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { PLATFORM_VERSION_ERROR_TYPES } from '../../constants.js';

vi.mock('../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../ui/index.js');

describe('lib/errorHandlers/suppressError', () => {
  const isMissingScopeErrorMock = isMissingScopeError as unknown as Mock;
  const isSpecifiedErrorMock = isSpecifiedError as unknown as Mock;
  const uiLoggerErrorMock = uiLogger.error as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    isMissingScopeErrorMock.mockReturnValue(false);
    isSpecifiedErrorMock.mockReturnValue(false);
  });

  describe('shouldSuppressError', () => {
    it('returns true and does not log for PromptExitError', () => {
      const error = new PromptExitError('User exited prompt', 0);

      const result = shouldSuppressError(error);

      expect(result).toBe(true);
      expect(uiLoggerErrorMock).not.toHaveBeenCalled();
    });

    it('returns true and logs for missing scope error', () => {
      isMissingScopeErrorMock.mockReturnValue(true);
      const error = new Error('Missing scope');

      const result = shouldSuppressError(error);

      expect(result).toBe(true);
      expect(uiLoggerErrorMock).toHaveBeenCalled();
    });

    it('returns true for platform version not specified error', () => {
      isSpecifiedErrorMock.mockImplementation(
        (_err: unknown, { subCategory }: { subCategory: string }) =>
          subCategory ===
          PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_NOT_SPECIFIED
      );

      const result = shouldSuppressError(new Error());

      expect(result).toBe(true);
    });

    it('returns true for platform version retired error', () => {
      isSpecifiedErrorMock.mockImplementation(
        (_err: unknown, { subCategory }: { subCategory: string }) =>
          subCategory === PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_RETIRED
      );

      const result = shouldSuppressError(new Error());

      expect(result).toBe(true);
    });

    it('returns true for platform version does not exist error', () => {
      isSpecifiedErrorMock.mockImplementation(
        (_err: unknown, { subCategory }: { subCategory: string }) =>
          subCategory ===
          PLATFORM_VERSION_ERROR_TYPES.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST
      );

      const result = shouldSuppressError(new Error());

      expect(result).toBe(true);
    });

    it('returns false for unrecognized errors', () => {
      const result = shouldSuppressError(new Error('Some other error'));

      expect(result).toBe(false);
    });

    it('returns false for non-PromptExitError instances', () => {
      const error = new Error('Regular error');

      const result = shouldSuppressError(error);

      expect(result).toBe(false);
    });
  });
});
