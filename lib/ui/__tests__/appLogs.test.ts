import { describe, it, expect, vi } from 'vitest';
import { AppLogDetails } from '@hubspot/local-dev-lib/types/AppLogs';
import { outputAppLogs, outputAppLogDetails } from '../appLogs.js';
import { renderTable } from '../../../ui/render.js';

vi.mock('../../../ui/render.js');
vi.mock('../../app/urls.js', () => ({
  getAppLogDetailsUrl: vi.fn().mockReturnValue('http://example.com/details'),
  getAppLogsUrl: vi.fn().mockReturnValue('http://example.com/logs'),
}));

const mockedRenderTable = vi.mocked(renderTable);

function getLoggedMessages(): string[] {
  return mockUiLogger.log.mock.calls
    .flat()
    .filter((msg: unknown) => typeof msg === 'string');
}

const BASE_OPTIONS = {
  accountId: 1,
  appId: 42,
  systemType: 'API_CALL',
  typeName: 'API Call',
};

const SUCCESS_LOG = {
  id: 'log-abc',
  createdAt: 1700000000000,
  status: 'SUCCESS' as const,
};

describe('lib/ui/appLogs', () => {
  beforeEach(() => {
    mockedRenderTable.mockResolvedValue(undefined);
  });

  describe('outputAppLogs()', () => {
    it('logs the no-logs message when results are empty', async () => {
      await outputAppLogs(
        { results: [], hasMore: false, offset: 0, total: 0 },
        BASE_OPTIONS
      );

      expect(mockUiLogger.log).toHaveBeenCalledTimes(1);
    });

    it('uses the choice format for --type in the view-details command reference', async () => {
      await outputAppLogs(
        { results: [SUCCESS_LOG], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      const viewDetailsMsg = getLoggedMessages().find(msg =>
        msg.includes('log-details')
      );
      expect(viewDetailsMsg).toBeDefined();
      expect(viewDetailsMsg).toContain('--type=api-call');
      expect(viewDetailsMsg).not.toContain('--type=API_CALL');
    });

    it('uses the choice format for non-underscore system types', async () => {
      await outputAppLogs(
        { results: [SUCCESS_LOG], hasMore: false, offset: 0, total: 1 },
        { ...BASE_OPTIONS, systemType: 'SERVERLESS_EXECUTION' }
      );

      const viewDetailsMsg = getLoggedMessages().find(msg =>
        msg.includes('log-details')
      );
      expect(viewDetailsMsg).toContain('--type=serverless-execution');
    });

    it('renders table with appId, typeName, and total in non-compact, non-tail mode', async () => {
      await outputAppLogs(
        { results: [SUCCESS_LOG], hasMore: false, offset: 0, total: 7 },
        BASE_OPTIONS
      );

      expect(mockedRenderTable).toHaveBeenCalledOnce();
      expect(mockedRenderTable).toHaveBeenCalledWith(
        expect.any(Array),
        [['42', 'API Call', '7']],
        true
      );
    });

    it('skips the table in compact mode', async () => {
      await outputAppLogs(
        { results: [SUCCESS_LOG], hasMore: false, offset: 0, total: 1 },
        { ...BASE_OPTIONS, compact: true }
      );

      expect(mockedRenderTable).not.toHaveBeenCalled();
    });

    it('skips the table in tail mode', async () => {
      await outputAppLogs(
        { results: [SUCCESS_LOG], hasMore: false, offset: 0, total: 1 },
        { ...BASE_OPTIONS, tail: true }
      );

      expect(mockedRenderTable).not.toHaveBeenCalled();
    });

    it('includes the log id in compact output', async () => {
      await outputAppLogs(
        { results: [SUCCESS_LOG], hasMore: false, offset: 0, total: 1 },
        { ...BASE_OPTIONS, compact: true }
      );

      const messages = getLoggedMessages();
      expect(messages.some(msg => msg.includes(SUCCESS_LOG.id))).toBe(true);
    });

    it('logs all results', async () => {
      const logs = [
        { ...SUCCESS_LOG, id: 'log-1' },
        { ...SUCCESS_LOG, id: 'log-2' },
        { ...SUCCESS_LOG, id: 'log-3' },
      ];

      await outputAppLogs(
        { results: logs, hasMore: false, offset: 0, total: 3 },
        BASE_OPTIONS
      );

      const messages = getLoggedMessages();
      expect(messages.some(msg => msg.includes('log-1'))).toBe(true);
      expect(messages.some(msg => msg.includes('log-2'))).toBe(true);
      expect(messages.some(msg => msg.includes('log-3'))).toBe(true);
    });

    it('shows duration when executionTimeMillis is present', async () => {
      const log = { ...SUCCESS_LOG, executionTimeMillis: 123 };

      await outputAppLogs(
        { results: [log], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      expect(getLoggedMessages().some(msg => msg.includes('123ms'))).toBe(true);
    });

    it('shows portalId when present', async () => {
      const log = { ...SUCCESS_LOG, portalId: 99999 };

      await outputAppLogs(
        { results: [log], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      expect(getLoggedMessages().some(msg => msg.includes('99999'))).toBe(true);
    });

    it('shows traceId when present and non-empty', async () => {
      const log = { ...SUCCESS_LOG, traceId: 'trace-xyz' };

      await outputAppLogs(
        { results: [log], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      expect(getLoggedMessages().some(msg => msg.includes('trace-xyz'))).toBe(
        true
      );
    });

    it('omits traceId when it is an empty string', async () => {
      const log = { ...SUCCESS_LOG, traceId: '' };

      await outputAppLogs(
        { results: [log], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      expect(getLoggedMessages().some(msg => msg.includes('Trace'))).toBe(
        false
      );
    });

    it('shows errorType for ERROR logs', async () => {
      const log = {
        ...SUCCESS_LOG,
        status: 'ERROR' as const,
        errorType: 'TIMEOUT',
      };

      await outputAppLogs(
        { results: [log], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      expect(getLoggedMessages().some(msg => msg.includes('TIMEOUT'))).toBe(
        true
      );
    });

    it('shows errorMessage for ERROR logs when present', async () => {
      const log = {
        ...SUCCESS_LOG,
        status: 'ERROR' as const,
        errorType: 'TIMEOUT',
        errorMessage: 'Request timed out after 30s',
      };

      await outputAppLogs(
        { results: [log], hasMore: false, offset: 0, total: 1 },
        BASE_OPTIONS
      );

      expect(
        getLoggedMessages().some(msg =>
          msg.includes('Request timed out after 30s')
        )
      ).toBe(true);
    });
  });

  describe('outputAppLogDetails()', () => {
    const BASE_DETAILS: AppLogDetails = {
      id: 'detail-abc',
      loggingSystemType: 'API_CALL',
      requestExecutionTimestamp: 1700000000000,
      appId: 42,
    };

    it('logs the log id', () => {
      outputAppLogDetails(BASE_DETAILS, { accountId: 1, appId: 42 });

      expect(getLoggedMessages().some(msg => msg.includes('detail-abc'))).toBe(
        true
      );
    });

    it('shows SUCCESS status when no errorType is present', () => {
      outputAppLogDetails(BASE_DETAILS, { accountId: 1, appId: 42 });

      expect(getLoggedMessages().some(msg => msg.includes('SUCCESS'))).toBe(
        true
      );
    });

    it('shows ERROR status when errorType is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, errorType: 'RUNTIME_ERROR' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('ERROR'))).toBe(true);
    });

    it('maps loggingSystemType to its display name', () => {
      outputAppLogDetails(BASE_DETAILS, { accountId: 1, appId: 42 });

      expect(getLoggedMessages().some(msg => msg.includes('API Call'))).toBe(
        true
      );
    });

    it('falls back to the raw loggingSystemType when no display name exists', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, loggingSystemType: 'UNKNOWN_TYPE' },
        { accountId: 1, appId: 42 }
      );

      expect(
        getLoggedMessages().some(msg => msg.includes('UNKNOWN_TYPE'))
      ).toBe(true);
    });

    it('shows duration when present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, duration: 250 },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('250ms'))).toBe(true);
    });

    it('omits duration when absent', () => {
      outputAppLogDetails(BASE_DETAILS, { accountId: 1, appId: 42 });

      expect(getLoggedMessages().some(msg => msg.includes('ms'))).toBe(false);
    });

    it('shows context info when portalId is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, portalId: 12345 },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('12345'))).toBe(true);
    });

    it('shows context info when traceId is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, traceId: 'trace-999' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('trace-999'))).toBe(
        true
      );
    });

    it('shows context info when serverlessFunction is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, serverlessFunction: 'myFunction' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('myFunction'))).toBe(
        true
      );
    });

    it('shows context info when cardName is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, cardName: 'My CRM Card' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('My CRM Card'))).toBe(
        true
      );
    });

    it('shows context info when location is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, location: 'us-east-1' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('us-east-1'))).toBe(
        true
      );
    });

    it('shows context info when userId is present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, portalId: 1, userId: 7777 },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('7777'))).toBe(true);
    });

    it('shows requestBody when present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, requestBody: '{"key":"value"}' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('key'))).toBe(true);
    });

    it('shows responseBody when present', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, responseBody: '{"result":"ok"}' },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('result'))).toBe(
        true
      );
    });

    it('shows errorType in the error section', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, errorType: 'RUNTIME_ERROR' },
        { accountId: 1, appId: 42 }
      );

      expect(
        getLoggedMessages().some(msg => msg.includes('RUNTIME_ERROR'))
      ).toBe(true);
    });

    it('shows errorMessage in the error section', () => {
      outputAppLogDetails(
        {
          ...BASE_DETAILS,
          errorType: 'RUNTIME_ERROR',
          errorMessage: 'null pointer at line 42',
        },
        { accountId: 1, appId: 42 }
      );

      expect(
        getLoggedMessages().some(msg => msg.includes('null pointer at line 42'))
      ).toBe(true);
    });

    it('shows extra info entries', () => {
      outputAppLogDetails(
        { ...BASE_DETAILS, extraInfo: { customKey: 'customValue' } },
        { accountId: 1, appId: 42 }
      );

      expect(getLoggedMessages().some(msg => msg.includes('customValue'))).toBe(
        true
      );
    });
  });
});
