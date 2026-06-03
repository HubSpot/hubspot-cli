import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as appLogsApi from '@hubspot/local-dev-lib/api/appLogs';
import * as appLogsUi from '../../ui/appLogs.js';
import { uiLogger } from '../../ui/logger.js';
import {
  SYSTEM_TYPE_DISPLAY_NAMES,
  transformApiLogEntry,
  handleLogsRequest,
  tailAppLogs,
  handleLogDetailsRequest,
} from '../logs.js';
import { handleExit, handleKeypress } from '../../process.js';
import { getAppLogsUrl, getAppLogDetailsUrl } from '../urls.js';
import SpinniesManager from '../../ui/SpinniesManager.js';

vi.mock('@hubspot/local-dev-lib/api/appLogs');
vi.mock('../../ui/appLogs.js');
vi.mock('../../projects/urls.js', () => ({
  getBaseHubSpotUrlForAccount: (accountId: number) =>
    `https://app.hubspot.com/portal/${accountId}`,
}));
vi.mock('../../ui/SpinniesManager.js', () => ({
  default: {
    add: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../../process.js');

const searchAppLogsSpy = vi.mocked(appLogsApi.searchAppLogs);
const getAppLogDetailsSpy = vi.mocked(appLogsApi.getAppLogDetails);
const outputAppLogsSpy = vi.mocked(appLogsUi.outputAppLogs);
const outputAppLogDetailsSpy = vi.mocked(appLogsUi.outputAppLogDetails);

const ACCOUNT_ID = 123456;
const APP_ID = 789;

const mockApiLogEntry = {
  id: 'log-abc',
  loggingSystemType: 'WEBHOOKS',
  requestExecutionTimestamp: 1_700_000_000_000,
  portalId: 111,
  traceId: 'trace-xyz',
  parentId: '',
  label: '',
  responseReceivedTimestamp: 1_700_000_000_100,
  duration: 100,
  errorType: undefined,
  appId: APP_ID,
};

const mockSearchResponse = {
  data: { results: [mockApiLogEntry], paging: undefined },
};

describe('lib/app/logs', () => {
  describe('SYSTEM_TYPE_DISPLAY_NAMES', () => {
    it('should not include UNDEFINED', () => {
      expect(SYSTEM_TYPE_DISPLAY_NAMES).not.toHaveProperty('UNDEFINED');
    });

    it.each([
      'WEBHOOKS',
      'API_CALL',
      'SERVERLESS_EXECUTION',
      'CRM_EXTENSIBILITY_CARD',
      'CRM_LEGACY_CARD',
      'EXTENSION_LOG',
      'EXTENSION_RENDER',
      'APP_SETTINGS',
      'PROXY_EXECUTION',
      'SERVERLESS_GATEWAY_EXECUTION',
      'ACCEPTANCE_TEST',
      'OAUTH_AUTHORIZATION',
    ])('should include %s', systemType => {
      expect(SYSTEM_TYPE_DISPLAY_NAMES[systemType]).toBeDefined();
    });
  });

  describe('transformApiLogEntry', () => {
    it('maps requestExecutionTimestamp to createdAt', () => {
      const result = transformApiLogEntry(mockApiLogEntry);
      expect(result.createdAt).toBe(mockApiLogEntry.requestExecutionTimestamp);
    });

    it('maps duration to executionTimeMillis', () => {
      const result = transformApiLogEntry(mockApiLogEntry);
      expect(result.executionTimeMillis).toBe(mockApiLogEntry.duration);
    });

    it('maps portalId and traceId', () => {
      const result = transformApiLogEntry(mockApiLogEntry);
      expect(result.portalId).toBe(mockApiLogEntry.portalId);
      expect(result.traceId).toBe(mockApiLogEntry.traceId);
    });

    it('sets status to SUCCESS when errorType is absent', () => {
      const result = transformApiLogEntry({
        ...mockApiLogEntry,
        errorType: undefined,
      });
      expect(result.status).toBe('SUCCESS');
    });

    it('sets status to ERROR when errorType is present', () => {
      const result = transformApiLogEntry({
        ...mockApiLogEntry,
        errorType: 'TIMEOUT',
      });
      expect(result.status).toBe('ERROR');
      expect(result.errorType).toBe('TIMEOUT');
    });

    it('maps errorMessage when present', () => {
      const result = transformApiLogEntry({
        ...mockApiLogEntry,
        errorMessage: 'Something went wrong',
      } as never);
      expect(result.errorMessage).toBe('Something went wrong');
    });

    it('maps errorMessage as undefined when absent', () => {
      const result = transformApiLogEntry(mockApiLogEntry);
      expect(result.errorMessage).toBeUndefined();
    });
  });

  describe('getAppLogsUrl', () => {
    it('returns a URL containing the accountId, appId, and systemType', () => {
      const url = getAppLogsUrl(ACCOUNT_ID, APP_ID, 'WEBHOOKS');
      expect(url).toContain(String(ACCOUNT_ID));
      expect(url).toContain(String(APP_ID));
      expect(url).toContain('WEBHOOKS');
    });
  });

  describe('getAppLogDetailsUrl', () => {
    it('returns a URL containing the logId in addition to the base URL fields', () => {
      const logId = 'log-abc-123';
      const url = getAppLogDetailsUrl(ACCOUNT_ID, APP_ID, 'WEBHOOKS', logId);
      expect(url).toContain(logId);
      expect(url).toContain(String(ACCOUNT_ID));
      expect(url).toContain('WEBHOOKS');
    });
  });

  describe('handleLogsRequest', () => {
    beforeEach(() => {
      searchAppLogsSpy.mockResolvedValue(mockSearchResponse as never);
      outputAppLogsSpy.mockResolvedValue(undefined);
    });

    it('calls searchAppLogs with loggingSystemType in query', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      expect(searchAppLogsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        expect.objectContaining({
          query: expect.objectContaining({ loggingSystemType: 'WEBHOOKS' }),
        })
      );
    });

    it('sets resultsOrder to DESC', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      expect(searchAppLogsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        expect.objectContaining({
          query: expect.objectContaining({ resultsOrder: 'DESC' }),
        })
      );
    });

    it('passes errorTypes wildcard when errorsOnly is set', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {
        errorsOnly: true,
      });

      expect(searchAppLogsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        expect.objectContaining({
          query: expect.objectContaining({ errorTypes: ['*'] }),
        })
      );
    });

    it('passes empty errorTypes when errorsOnly is not set', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      expect(searchAppLogsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        expect.objectContaining({
          query: expect.objectContaining({ errorTypes: [] }),
        })
      );
    });

    it('calls uiLogger.json instead of outputAppLogs when json option is set', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', { json: true });

      expect(uiLogger.json).toHaveBeenCalledWith(mockSearchResponse.data);
      expect(outputAppLogsSpy).not.toHaveBeenCalled();
    });

    it('calls outputAppLogs with transformed results when json is not set', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      expect(outputAppLogsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ id: mockApiLogEntry.id }),
          ]),
        }),
        expect.objectContaining({ systemType: 'WEBHOOKS' })
      );
    });

    it('includes startTime and endTime in query when since option is provided', async () => {
      await handleLogsRequest(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {
        since: '1h',
      });

      expect(searchAppLogsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        expect.objectContaining({
          query: expect.objectContaining({
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('tailAppLogs', () => {
    let capturedExitCallback: Parameters<typeof handleExit>[0];
    let capturedKeypressCallback: Parameters<typeof handleKeypress>[0];

    beforeEach(() => {
      vi.useFakeTimers();
      searchAppLogsSpy.mockResolvedValue(mockSearchResponse as never);
      outputAppLogsSpy.mockResolvedValue(undefined);

      vi.mocked(handleExit).mockImplementation(cb => {
        capturedExitCallback = cb;
        return vi.fn();
      });
      vi.mocked(handleKeypress).mockImplementation(cb => {
        capturedKeypressCallback = cb;
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds spinners when started', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(SpinniesManager.add).toHaveBeenCalledTimes(2);
      });

      capturedKeypressCallback({ name: 'q' });
      await tailPromise;
    });

    it('calls searchAppLogs with ASC resultsOrder on initial poll', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(searchAppLogsSpy).toHaveBeenCalled();
      });

      capturedKeypressCallback({ name: 'q' });
      await tailPromise;

      expect(searchAppLogsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        expect.objectContaining({
          query: expect.objectContaining({
            loggingSystemType: 'WEBHOOKS',
            resultsOrder: 'ASC',
          }),
        })
      );
    });

    it('calls outputAppLogs with tail: true when results exist', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(outputAppLogsSpy).toHaveBeenCalled();
      });

      capturedKeypressCallback({ name: 'q' });
      await tailPromise;

      expect(outputAppLogsSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ tail: true })
      );
    });

    it('terminates and removes spinners when q is pressed', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(handleKeypress).toHaveBeenCalled();
      });

      capturedKeypressCallback({ name: 'q' });
      await tailPromise;

      expect(SpinniesManager.remove).toHaveBeenCalled();
    });

    it('terminates when ctrl+c is pressed', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(handleKeypress).toHaveBeenCalled();
      });

      capturedKeypressCallback({ ctrl: true, name: 'c' });
      await tailPromise;

      expect(SpinniesManager.remove).toHaveBeenCalled();
    });

    it('terminates via the exit handler', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(handleExit).toHaveBeenCalled();
      });

      capturedExitCallback({ isSIGHUP: false });
      await tailPromise;

      expect(SpinniesManager.remove).toHaveBeenCalled();
    });

    it('polls again after TAIL_DELAY', async () => {
      const tailPromise = tailAppLogs(ACCOUNT_ID, APP_ID, 'WEBHOOKS', {});

      await vi.waitFor(() => {
        expect(searchAppLogsSpy).toHaveBeenCalledTimes(1);
      });

      await vi.advanceTimersByTimeAsync(5001);

      await vi.waitFor(() => {
        expect(searchAppLogsSpy).toHaveBeenCalledTimes(2);
      });

      capturedKeypressCallback({ name: 'q' });
      await tailPromise;
    });
  });

  describe('handleLogDetailsRequest', () => {
    const LOG_ID = 'log-abc-123';
    const mockLogDetails = {
      id: LOG_ID,
      loggingSystemType: 'WEBHOOKS',
      requestExecutionTimestamp: 1_700_000_000_000,
      appId: APP_ID,
    };

    beforeEach(() => {
      getAppLogDetailsSpy.mockResolvedValue({
        data: { log: mockLogDetails },
      } as never);
      outputAppLogDetailsSpy.mockReturnValue(undefined);
    });

    it('calls getAppLogDetails with accountId, appId, systemType, and logId', async () => {
      await handleLogDetailsRequest(ACCOUNT_ID, APP_ID, LOG_ID, 'WEBHOOKS', {});

      expect(getAppLogDetailsSpy).toHaveBeenCalledWith(
        ACCOUNT_ID,
        APP_ID,
        'WEBHOOKS',
        LOG_ID
      );
    });

    it('calls uiLogger.json instead of outputAppLogDetails when json option is set', async () => {
      await handleLogDetailsRequest(ACCOUNT_ID, APP_ID, LOG_ID, 'WEBHOOKS', {
        json: true,
      });

      expect(uiLogger.json).toHaveBeenCalledWith({ log: mockLogDetails });
      expect(outputAppLogDetailsSpy).not.toHaveBeenCalled();
    });

    it('calls outputAppLogDetails with the log when json is not set', async () => {
      await handleLogDetailsRequest(ACCOUNT_ID, APP_ID, LOG_ID, 'WEBHOOKS', {
        json: false,
      });

      expect(outputAppLogDetailsSpy).toHaveBeenCalledWith(
        mockLogDetails,
        expect.objectContaining({ accountId: ACCOUNT_ID, appId: APP_ID })
      );
    });
  });
});
