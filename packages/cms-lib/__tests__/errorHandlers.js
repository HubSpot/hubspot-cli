const { StatusCodeError } = require('request-promise-native/errors');
const { getAccountConfig } = require('../lib/config');
const { fetchScopeData } = require('../api/localDevAuth/authenticated');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logFileSystemErrorInstance,
  logServerlessFunctionApiErrorInstance,
} = require('../errorHandlers');
const { LOG_LEVEL, logger } = require('../logger');

jest.mock('../lib/config');
jest.mock('../logger');
jest.mock('../api/localDevAuth/authenticated');

function createApiError(statusCode, method) {
  return Object.freeze({
    statusCode,
    name: 'StatusCodeError',
    options: Object.freeze({
      method,
    }),
    response: {
      request: {
        href: 'http://example.com/',
        method: 'GET',
      },
    },
    message: `TEST ${method} ${statusCode}`,
  });
}

function isErrorAndContextDebug(tuple) {
  return (
    tuple[0] &&
    tuple[0].indexOf('Error: ') === 0 &&
    tuple[1] &&
    tuple[1].indexOf('Context: ') === 0
  );
}

function testErrorAndContextDebug(totalErrors) {
  let testCount = 0;
  for (let count = totalErrors, idx = 0; count--; idx += 2) {
    ++testCount;
    expect(
      isErrorAndContextDebug(logger.logs[LOG_LEVEL.DEBUG].slice(idx, idx + 2))
    ).toBe(true);
  }
  return testCount;
}

const systemError = Object.freeze({
  code: 'ENOTDIR',
  errno: -20,
  syscall: 'mkdir',
  message: 'ENOTDIR: mkdir, not a directory',
});

const errorContext = Object.freeze({
  accountId: 12345,
});

const apiErrorContext = Object.freeze({
  ...errorContext,
  request: 'a/b/c',
  payload: 'new.js',
});

const fileSystemErrorContext = Object.freeze({
  ...errorContext,
  filepath: 'x/y/z.html',
});

describe('cms-lib/errorHandlers', () => {
  beforeEach(() => {
    logger.clear();
  });

  describe('logApiErrorInstance()', () => {
    describe('StatusCodeError', () => {
      let totalErrors;
      beforeEach(() => {
        totalErrors = [
          logApiErrorInstance(createApiError(301, 'GET'), apiErrorContext),
          logApiErrorInstance(createApiError(404, 'GET'), errorContext),
          logApiErrorInstance(createApiError(404, 'GET'), apiErrorContext),
          logApiErrorInstance(createApiError(404, 'PUT'), apiErrorContext),
          logApiErrorInstance(createApiError(404, 'POST'), apiErrorContext),
          logApiErrorInstance(createApiError(404, 'DELETE'), apiErrorContext),
          logApiErrorInstance(createApiError(500, 'DELETE'), apiErrorContext),
          logApiErrorInstance(createApiError(500, 'GET'), apiErrorContext),
          logApiErrorInstance(createApiError(500, 'POST'), apiErrorContext),
          logApiErrorInstance(createApiError(503, 'GET'), apiErrorContext),
          // Mimic an API command with no payload
          logApiErrorInstance(createApiError(404, 'POST'), {
            ...apiErrorContext,
            payload: null,
          }),
          // Mimic an API response that includes a message.
          logApiErrorInstance(
            {
              ...createApiError(404, 'GET'),
              error: {
                message: 'Meaningful message from server.',
              },
            },
            apiErrorContext
          ),
        ].length;
      });
      it('should log a readable error message from provided Status Code error and optional context data', () => {
        expect(logger.logs[LOG_LEVEL.ERROR]).toEqual([
          'The request for "a/b/c" in account 12345 failed.',
          'The request in account 12345 was not found.',
          'The request failed because "a/b/c" was not found in account 12345.',
          'Unable to upload "new.js". The update failed because "a/b/c" was not found in account 12345.',
          'Unable to upload "new.js". The post failed because "a/b/c" was not found in account 12345.',
          'The delete failed because "a/b/c" was not found in account 12345.',
          'The delete of "a/b/c" in account 12345 failed due to a server error. Please try again or visit https://help.hubspot.com/ to submit a ticket or contact HubSpot Support if the issue persists.',
          'The request for "a/b/c" in account 12345 failed due to a server error. Please try again or visit https://help.hubspot.com/ to submit a ticket or contact HubSpot Support if the issue persists.',
          'Unable to upload "new.js". The post to "a/b/c" in account 12345 failed due to a server error. Please try again or visit https://help.hubspot.com/ to submit a ticket or contact HubSpot Support if the issue persists.',
          'The request for "a/b/c" in account 12345 could not be handled at this time. Please try again or visit https://help.hubspot.com/ to submit a ticket or contact HubSpot Support if the issue persists.',
          'The post failed because "a/b/c" was not found in account 12345.',
          'The request failed because "a/b/c" was not found in account 12345. Meaningful message from server.',
        ]);
      });
      it('should log debugs with details of error and context', () => {
        expect(testErrorAndContextDebug(totalErrors)).toBe(totalErrors);
      });
    });
  });

  describe('logFileSystemErrorInstance()', () => {
    describe('Non SystemError', () => {
      let totalErrors;
      beforeEach(() => {
        const error = { message: 'foo' };
        totalErrors = [
          logFileSystemErrorInstance(error, fileSystemErrorContext),
          logFileSystemErrorInstance(error, {
            ...fileSystemErrorContext,
            read: true,
          }),
          logFileSystemErrorInstance(error, {
            ...fileSystemErrorContext,
            write: true,
          }),
        ].length;
      });
      it('should log a readable error with details about the filesystem error', () => {
        expect(logger.logs[LOG_LEVEL.ERROR]).toEqual([
          'An error occurred while accessing "x/y/z.html".',
          'An error occurred while reading from "x/y/z.html".',
          'An error occurred while writing to "x/y/z.html".',
        ]);
      });
      it('should log debugs with details of error and context', () => {
        expect(testErrorAndContextDebug(totalErrors)).toBe(totalErrors);
      });
    });
    describe('SystemError', () => {
      let totalErrors;
      beforeEach(() => {
        totalErrors = [
          logFileSystemErrorInstance(systemError, fileSystemErrorContext),
          logFileSystemErrorInstance(systemError, {
            ...fileSystemErrorContext,
            read: true,
          }),
          logFileSystemErrorInstance(systemError, {
            ...fileSystemErrorContext,
            write: true,
          }),
        ].length;
      });
      it('should log an additional error if the error is the result of a system error', () => {
        expect(logger.logs[LOG_LEVEL.ERROR]).toEqual([
          'An error occurred while accessing "x/y/z.html". This is the result of a system error: ENOTDIR: mkdir, not a directory',
          'An error occurred while reading from "x/y/z.html". This is the result of a system error: ENOTDIR: mkdir, not a directory',
          'An error occurred while writing to "x/y/z.html". This is the result of a system error: ENOTDIR: mkdir, not a directory',
        ]);
      });
      it('should log debugs with details of error and context', () => {
        expect(testErrorAndContextDebug(totalErrors)).toBe(totalErrors);
      });
    });
  });

  describe('logServerlessApiErrorInstance', () => {
    const accountId = 123;
    const logErrorSpy = jest.spyOn(logger, 'error');
    beforeEach(() => {
      logger.clear();
      getAccountConfig.mockReturnValue({
        accountId,
        authType: 'personalaccesskey',
        personalAccessKey: 'let-me-in',
      });
    });
    afterEach(() => {
      logErrorSpy.mockReset();
    });
    it('logs normal errors', async () => {
      const message = 'Something went wrong';
      const error = new Error(message);
      await logServerlessFunctionApiErrorInstance(
        accountId,
        error,
        new ApiErrorContext({
          request: 'add secret',
          accountId,
        })
      );
      expect(logErrorSpy).toHaveBeenCalledWith(
        `A Error has occurred. ${message}`
      );
    });
    it('detects scope error with hub scope', async () => {
      const error = new StatusCodeError(403, {
        category: 'MISSING_SCOPES',
      });
      fetchScopeData.mockImplementation(() =>
        Promise.resolve({
          accountId,
          userId: 456,
          scopeGroup: 'cms.functions.read_write',
          portalScopesInGroup: [
            'SERVERLESS_FUNCTIONS',
            'SERVERLESS_FUNCTIONS_READ',
            'SERVERLESS_FUNCTIONS_WRITE',
          ],
          userScopesInGroup: [
            'SERVERLESS_FUNCTIONS',
            'SERVERLESS_FUNCTIONS_READ',
            'SERVERLESS_FUNCTIONS_WRITE',
          ],
          portalUserScopeIntersection: [
            'SERVERLESS_FUNCTIONS',
            'SERVERLESS_FUNCTIONS_READ',
            'SERVERLESS_FUNCTIONS_WRITE',
          ],
        })
      );
      await logServerlessFunctionApiErrorInstance(
        accountId,
        error,
        new ApiErrorContext({
          request: 'add secret',
          accountId,
        })
      );
      expect(logErrorSpy).toHaveBeenCalledWith(
        'Your access key does not allow this action. Please generate a new access key by running "hs auth personalaccesskey".'
      );
    });
  });
});
