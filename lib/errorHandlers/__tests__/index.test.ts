import { Mock } from 'vitest';
import {
  logError,
  debugError,
  ApiErrorContext,
  isErrorWithMessageOrReason,
  getErrorMessage,
} from '../index.js';
import { uiLogger } from '../../ui/logger.js';
import {
  isHubSpotHttpError,
  isValidationError,
} from '@hubspot/local-dev-lib/errors/index';
import { getConfig } from '@hubspot/local-dev-lib/config';
import { shouldSuppressError } from '../suppressError.js';
import { isProjectValidationError } from '../../errors/ProjectValidationError.js';
import { lib } from '../../../lang/en.js';

vi.mock('../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../suppressError.js');
vi.mock('../../errors/ProjectValidationError.js');

describe('lib/errorHandlers/index', () => {
  const uiLoggerErrorMock = uiLogger.error as Mock;
  const uiLoggerDebugMock = uiLogger.debug as Mock;
  const isHubSpotHttpErrorMock = isHubSpotHttpError as unknown as Mock;
  const isValidationErrorMock = isValidationError as unknown as Mock;
  const getConfigMock = getConfig as Mock;
  const shouldSuppressErrorMock = shouldSuppressError as Mock;
  const isProjectValidationErrorMock =
    isProjectValidationError as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    isHubSpotHttpErrorMock.mockReturnValue(false);
    isValidationErrorMock.mockReturnValue(false);
    shouldSuppressErrorMock.mockReturnValue(false);
    isProjectValidationErrorMock.mockReturnValue(false);
    getConfigMock.mockReturnValue({});
  });

  describe('logError', () => {
    it('logs ProjectValidationError message and returns early', () => {
      const error = {
        message: 'Project validation failed',
        name: 'ProjectValidationError',
      };
      isProjectValidationErrorMock.mockReturnValue(true);

      logError(error);

      expect(uiLoggerErrorMock).toHaveBeenCalledWith(
        'Project validation failed'
      );
      expect(uiLoggerErrorMock).toHaveBeenCalledTimes(1);
    });

    it('returns early when error should be suppressed', () => {
      const error = new Error('Suppressed error');
      shouldSuppressErrorMock.mockReturnValue(true);

      logError(error);

      expect(shouldSuppressErrorMock).toHaveBeenCalled();
      expect(uiLoggerErrorMock).not.toHaveBeenCalled();
    });

    it('logs validation errors for HubSpotHttpError with validation errors', () => {
      const mockError = {
        formattedValidationErrors: vi
          .fn()
          .mockReturnValue('Formatted validation errors'),
        updateContext: vi.fn(),
        context: {},
      };
      isHubSpotHttpErrorMock.mockReturnValue(true);
      isValidationErrorMock.mockReturnValue(true);

      logError(mockError);

      expect(mockError.formattedValidationErrors).toHaveBeenCalled();
      expect(uiLoggerErrorMock).toHaveBeenCalledWith(
        'Formatted validation errors'
      );
    });

    it('logs error message for errors with message property', () => {
      const error = new Error('Something went wrong');

      logError(error);

      expect(uiLoggerErrorMock).toHaveBeenCalledWith('Something went wrong');
    });

    it('logs error with both message and reason', () => {
      const error = { message: 'Error message', reason: 'Error reason' };

      logError(error);

      expect(uiLoggerErrorMock).toHaveBeenCalledWith(
        'Error message Error reason'
      );
    });

    it('logs unknown error message for errors without message or reason', () => {
      const error = { foo: 'bar' };

      logError(error);

      expect(uiLoggerErrorMock).toHaveBeenCalledWith(
        lib.errorHandlers.index.unknownErrorOccurred
      );
    });

    it('calls updateContext on HubSpotHttpError', () => {
      const mockError = {
        updateContext: vi.fn(),
        context: {},
        message: 'test',
      };
      isHubSpotHttpErrorMock.mockReturnValue(true);

      logError(mockError);

      expect(mockError.updateContext).toHaveBeenCalled();
    });

    describe('timeout error handling', () => {
      it('shows config timeout message for direct ETIMEDOUT error matching default timeout', () => {
        const mockError = {
          code: 'ETIMEDOUT',
          timeout: 15000,
          updateContext: vi.fn(),
          context: {},
          message: 'Timeout',
        };
        isHubSpotHttpErrorMock.mockReturnValue(true);
        getConfigMock.mockReturnValue({ httpTimeout: 15000 });

        logError(mockError);

        expect(uiLoggerErrorMock).toHaveBeenCalledTimes(2);
        expect(uiLoggerErrorMock).toHaveBeenNthCalledWith(1, 'Timeout');
        expect(uiLoggerErrorMock).toHaveBeenNthCalledWith(
          2,
          lib.errorHandlers.index.configTimeoutErrorOccurred(
            15000,
            'hs config set'
          )
        );
      });

      it('shows generic timeout message for direct ETIMEDOUT error with custom timeout', () => {
        const mockError = {
          code: 'ETIMEDOUT',
          timeout: 30000,
          updateContext: vi.fn(),
          context: {},
          message: 'Timeout',
        };
        isHubSpotHttpErrorMock.mockReturnValue(true);
        getConfigMock.mockReturnValue({ httpTimeout: 15000 });

        logError(mockError);

        expect(uiLoggerErrorMock).toHaveBeenCalledTimes(2);
        expect(uiLoggerErrorMock).toHaveBeenNthCalledWith(
          2,
          lib.errorHandlers.index.genericTimeoutErrorOccurred
        );
      });

      it('detects timeout error wrapped in error.cause', () => {
        const causeError = {
          code: 'ETIMEDOUT',
          timeout: 15000,
          name: 'HubSpotHttpError',
        };

        const wrapperError = new Error('Assets unavailable');
        Object.defineProperty(wrapperError, 'cause', {
          value: causeError,
          writable: true,
        });

        isHubSpotHttpErrorMock.mockImplementation(err => {
          return err === causeError;
        });
        getConfigMock.mockReturnValue({ httpTimeout: 15000 });

        logError(wrapperError);

        expect(uiLoggerErrorMock).toHaveBeenCalledWith('Assets unavailable');
        expect(uiLoggerErrorMock).toHaveBeenCalledWith(
          lib.errorHandlers.index.configTimeoutErrorOccurred(
            15000,
            'hs config set'
          )
        );
      });

      it('shows generic timeout message for wrapped timeout with different timeout value', () => {
        const causeError = {
          code: 'ETIMEDOUT',
          timeout: 60000,
          name: 'HubSpotHttpError',
        };

        const wrapperError = new Error('Assets unavailable');
        Object.defineProperty(wrapperError, 'cause', {
          value: causeError,
          writable: true,
        });

        isHubSpotHttpErrorMock.mockImplementation(err => {
          return err === causeError;
        });
        getConfigMock.mockReturnValue({ httpTimeout: 15000 });

        logError(wrapperError);

        expect(uiLoggerErrorMock).toHaveBeenCalledTimes(2);
        expect(uiLoggerErrorMock).toHaveBeenNthCalledWith(
          2,
          lib.errorHandlers.index.genericTimeoutErrorOccurred
        );
      });

      it('does not show timeout message for non-timeout errors', () => {
        const error = new Error('Regular error');

        logError(error);

        expect(uiLoggerErrorMock).toHaveBeenCalledTimes(1);
        expect(uiLoggerErrorMock).toHaveBeenCalledWith('Regular error');
      });
    });
  });

  describe('debugError', () => {
    it('logs HubSpotHttpError using toString', () => {
      const mockError = {
        toString: vi.fn().mockReturnValue('HubSpotHttpError details'),
      };
      isHubSpotHttpErrorMock.mockReturnValue(true);

      debugError(mockError);

      expect(uiLoggerDebugMock).toHaveBeenCalledWith(
        'HubSpotHttpError details'
      );
    });

    it('logs regular error using lib.errorHandlers.index.errorOccurred', () => {
      const error = new Error('Regular error');

      debugError(error);

      expect(uiLoggerDebugMock).toHaveBeenCalledWith(
        lib.errorHandlers.index.errorOccurred('Error: Regular error')
      );
    });

    it('logs error.cause when it is a HubSpotHttpError', () => {
      const causeError = {
        toString: vi.fn().mockReturnValue('Cause error details'),
      };

      const error = new Error('Wrapper error');
      Object.defineProperty(error, 'cause', {
        value: causeError,
        writable: true,
      });

      isHubSpotHttpErrorMock.mockImplementation(err => {
        return err === causeError;
      });

      debugError(error);

      expect(causeError.toString).toHaveBeenCalled();
      expect(uiLoggerDebugMock).toHaveBeenCalledWith('Cause error details');
    });

    it('logs error.cause using lib.errorHandlers.index.errorCause when not a HubSpotHttpError', () => {
      const causeError = { customField: 'value' };

      const error = new Error('Wrapper error');
      Object.defineProperty(error, 'cause', {
        value: causeError,
        writable: true,
      });

      debugError(error);

      expect(uiLoggerDebugMock).toHaveBeenCalledWith(
        expect.stringMatching(/^Cause:/)
      );
    });

    it('logs context using lib.errorHandlers.index.errorContext when provided', () => {
      const error = new Error('Error');
      const context = new ApiErrorContext({
        accountId: 123,
        request: '/api/test',
      });

      debugError(error, context);

      expect(uiLoggerDebugMock).toHaveBeenCalledWith(
        expect.stringMatching(/^Context:/)
      );
    });
  });

  describe('ApiErrorContext', () => {
    it('creates context with all properties', () => {
      const context = new ApiErrorContext({
        accountId: 123,
        request: '/api/test',
        payload: '{"data": "value"}',
        projectName: 'my-project',
      });

      expect(context.accountId).toBe(123);
      expect(context.request).toBe('/api/test');
      expect(context.payload).toBe('{"data": "value"}');
      expect(context.projectName).toBe('my-project');
    });

    it('creates context with default values', () => {
      const context = new ApiErrorContext();

      expect(context.accountId).toBeUndefined();
      expect(context.request).toBe('');
      expect(context.payload).toBe('');
      expect(context.projectName).toBe('');
    });

    it('creates context with partial properties', () => {
      const context = new ApiErrorContext({
        accountId: 456,
      });

      expect(context.accountId).toBe(456);
      expect(context.request).toBe('');
      expect(context.payload).toBe('');
      expect(context.projectName).toBe('');
    });
  });

  describe('isErrorWithMessageOrReason', () => {
    it('returns true for object with message property', () => {
      expect(isErrorWithMessageOrReason({ message: 'test' })).toBe(true);
    });

    it('returns true for object with reason property', () => {
      expect(isErrorWithMessageOrReason({ reason: 'test' })).toBe(true);
    });

    it('returns true for object with both message and reason', () => {
      expect(
        isErrorWithMessageOrReason({ message: 'msg', reason: 'rsn' })
      ).toBe(true);
    });

    it('returns true for Error instances', () => {
      expect(isErrorWithMessageOrReason(new Error('test'))).toBe(true);
    });

    it('returns false for null', () => {
      expect(isErrorWithMessageOrReason(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isErrorWithMessageOrReason(undefined)).toBe(false);
    });

    it('returns false for primitive values', () => {
      expect(isErrorWithMessageOrReason('string')).toBe(false);
      expect(isErrorWithMessageOrReason(123)).toBe(false);
      expect(isErrorWithMessageOrReason(true)).toBe(false);
    });

    it('returns false for object without message or reason', () => {
      expect(isErrorWithMessageOrReason({ foo: 'bar' })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isErrorWithMessageOrReason({})).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('returns message from Error instance', () => {
      expect(getErrorMessage(new Error('Error message'))).toBe('Error message');
    });
  });
});
