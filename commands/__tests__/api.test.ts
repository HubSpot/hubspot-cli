import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import apiCommand, { ApiArgs } from '../api.js';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotApiOrigin } from '@hubspot/local-dev-lib/urls';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { debugError, logError } from '../../lib/errorHandlers/index.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { Mocked, MockedFunction } from 'vitest';

function mockResponse(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data } as any;
}

vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('@hubspot/local-dev-lib/urls');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../lib/errorHandlers/index.js');
vi.mock('../../lib/commonOpts');

const mockHttp = http as Mocked<typeof http>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;
const mockGetHubSpotApiOrigin = vi.mocked(getHubSpotApiOrigin);
const mockGetConfigAccountEnvironment = vi.mocked(getConfigAccountEnvironment);
const mockDebugError = vi.mocked(debugError);
const mockLogError = vi.mocked(logError);

const positionalSpy = vi.spyOn(mockYargs, 'positional');
const optionSpy = vi.spyOn(mockYargs, 'option');
const exampleSpy = vi.spyOn(mockYargs, 'example');
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/api', () => {
  const accountId = 123456;

  beforeEach(() => {
    // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
    processExitSpy.mockImplementation(() => {});
    mockGetHubSpotApiOrigin.mockReturnValue('https://api.hubapi.com');
    mockGetConfigAccountEnvironment.mockReturnValue('prod');
    mockIsHubSpotHttpError.mockReturnValue(false);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(apiCommand.command).toBe('api <endpoint>');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(apiCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should add the endpoint positional argument', () => {
      apiCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith('endpoint', {
        describe: expect.any(String),
        type: 'string',
      });
    });

    it('should add the method option', () => {
      apiCommand.builder(yargs as Argv);
      expect(optionSpy).toHaveBeenCalledWith('method', {
        alias: 'X',
        describe: expect.any(String),
        type: 'string',
        coerce: expect.any(Function),
        choices: [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'get',
          'post',
          'put',
          'patch',
          'delete',
        ],
      });
    });

    it('should add the data option', () => {
      apiCommand.builder(yargs as Argv);
      expect(optionSpy).toHaveBeenCalledWith('data', {
        describe: expect.any(String),
        type: 'string',
      });
    });

    it('should add examples', () => {
      apiCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    const defaultArgs = {
      endpoint: 'crm/v3/objects/contacts',
      derivedAccountId: accountId,
    } as ArgumentsCamelCase<ApiArgs>;

    it('should track command usage', async () => {
      mockHttp.get.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler(defaultArgs);
      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'api',
        { action: 'GET', successful: true },
        accountId
      );
    });

    it('should default to GET when no method or data is provided', async () => {
      mockHttp.get.mockResolvedValueOnce(mockResponse({ results: [] }));

      await apiCommand.handler(defaultArgs);
      expect(mockHttp.get).toHaveBeenCalledWith(accountId, {
        url: 'crm/v3/objects/contacts',
      });
    });

    it('should default to POST when data is provided without a method', async () => {
      mockHttp.post.mockResolvedValueOnce(mockResponse({ id: '1' }));

      await apiCommand.handler({
        ...defaultArgs,
        data: '{"properties":{"email":"test@example.com"}}',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(mockHttp.post).toHaveBeenCalledWith(accountId, {
        url: 'crm/v3/objects/contacts',
        data: { properties: { email: 'test@example.com' } },
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should use the specified HTTP method', async () => {
      mockHttp.put.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler({
        ...defaultArgs,
        method: 'PUT',
        data: '{"name":"updated"}',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(mockHttp.put).toHaveBeenCalledWith(accountId, {
        url: 'crm/v3/objects/contacts',
        data: { name: 'updated' },
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should support PATCH requests', async () => {
      mockHttp.patch.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler({
        ...defaultArgs,
        method: 'PATCH',
        data: '{"name":"patched"}',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(mockHttp.patch).toHaveBeenCalledWith(accountId, {
        url: 'crm/v3/objects/contacts',
        data: { name: 'patched' },
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should support DELETE requests', async () => {
      mockHttp.delete.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler({
        ...defaultArgs,
        method: 'DELETE',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(mockHttp.delete).toHaveBeenCalledWith(accountId, {
        url: 'crm/v3/objects/contacts',
      });
    });

    it('should strip leading slash from endpoint', async () => {
      mockHttp.get.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler({
        ...defaultArgs,
        endpoint: '/crm/v3/objects/contacts',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(mockHttp.get).toHaveBeenCalledWith(accountId, {
        url: 'crm/v3/objects/contacts',
      });
    });

    it('should log the request details', async () => {
      mockHttp.get.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler(defaultArgs);

      expect(uiLogger.log).toHaveBeenCalledWith(expect.stringContaining('GET'));
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.hubapi.com/crm/v3/objects/contacts'
        )
      );
    });

    it('should log the request body when data is provided', async () => {
      mockHttp.post.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler({
        ...defaultArgs,
        data: '{"key":"value"}',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Request body:')
      );
    });

    it('should log the response as formatted JSON', async () => {
      const responseData = { results: [{ id: '1' }] };
      mockHttp.get.mockResolvedValueOnce(mockResponse(responseData));

      await apiCommand.handler(defaultArgs);

      expect(uiLogger.log).toHaveBeenCalledWith(
        JSON.stringify(responseData, null, 2)
      );
    });

    it('should exit with SUCCESS on a successful response', async () => {
      mockHttp.get.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler(defaultArgs);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with ERROR when JSON data is invalid', async () => {
      await apiCommand.handler({
        ...defaultArgs,
        data: 'not-valid-json',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('not valid JSON')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show status line and response body for HTTP errors', async () => {
      const httpError = {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Resource not found' },
        message: 'Not Found',
      };
      mockHttp.get.mockRejectedValueOnce(httpError);
      mockIsHubSpotHttpError.mockReturnValueOnce(true);

      await apiCommand.handler(defaultArgs);

      expect(mockDebugError).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('404')
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        JSON.stringify(httpError.data, null, 2)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show error message when HTTP error has no response body', async () => {
      const httpError = {
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
        message: 'Something went wrong',
      };
      mockHttp.get.mockRejectedValueOnce(httpError);
      mockIsHubSpotHttpError.mockReturnValueOnce(true);

      await apiCommand.handler(defaultArgs);

      expect(uiLogger.error).toHaveBeenCalledWith('Something went wrong');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should use logError for non-HTTP errors', async () => {
      const error = new Error('Network failure');
      mockHttp.get.mockRejectedValueOnce(error);
      mockIsHubSpotHttpError.mockReturnValueOnce(false);

      await apiCommand.handler(defaultArgs);

      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should output only raw JSON when --json is passed', async () => {
      const responseData = { results: [{ id: '1' }] };
      mockHttp.get.mockResolvedValueOnce(mockResponse(responseData));

      await apiCommand.handler({
        ...defaultArgs,
        json: true,
      } as ArgumentsCamelCase<ApiArgs>);

      expect(uiLogger.json).toHaveBeenCalledWith(responseData);
      expect(uiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
      expect(uiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Response:')
      );
    });

    it('should not output uiLogger.json when --json is not passed', async () => {
      mockHttp.get.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler(defaultArgs);

      expect(uiLogger.json).not.toHaveBeenCalled();
    });

    it('should output error response as JSON when --json is passed', async () => {
      const httpError = {
        status: 409,
        statusText: 'Conflict',
        data: { message: 'Table already exists' },
        message: 'Conflict',
      };
      mockHttp.post.mockRejectedValueOnce(httpError);
      mockIsHubSpotHttpError.mockReturnValueOnce(true);

      await apiCommand.handler({
        ...defaultArgs,
        json: true,
        data: '{"name":"test"}',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(uiLogger.json).toHaveBeenCalledWith(httpError.data);
      expect(uiLogger.error).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should include the HTTP method in usage tracking metadata', async () => {
      mockHttp.post.mockResolvedValueOnce(mockResponse({}));

      await apiCommand.handler({
        ...defaultArgs,
        data: '{"key":"value"}',
      } as ArgumentsCamelCase<ApiArgs>);

      expect(trackCommandUsage).toHaveBeenCalledWith(
        'api',
        { action: 'POST', successful: true },
        accountId
      );
    });
  });
});
