import { outputLogs } from '../ui/serverlessFunctionLogs.js';
import { tailLogs } from '../serverlessLogs.js';
import { handleKeypress } from '../process.js';
import type { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import type {
  FunctionLog,
  GetFunctionLogsResponse,
} from '@hubspot/local-dev-lib/types/Functions';
import type { InternalAxiosRequestConfig } from 'axios';

vi.mock('../ui/serverlessFunctionLogs');
vi.mock('../ui/SpinniesManager', () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stopAll: vi.fn(),
  },
}));
vi.mock('../process');
vi.useFakeTimers();

const ACCOUNT_ID = 123;

function terminateTailLogs(): void {
  const keypressCallback = vi.mocked(handleKeypress).mock.calls[0][0];
  keypressCallback({ name: 'q' });
}

describe('lib/serverlessLogs', () => {
  describe('tailLogs()', () => {
    afterEach(() => {
      vi.clearAllTimers();
      vi.clearAllMocks();
    });

    it('calls tailCall() to get the next results', async () => {
      const compact = false;
      const fetchLatest = vi.fn(
        () =>
          Promise.resolve({
            data: {
              id: '1234',
              executionTime: 510,
              log: 'Log message',
              error: { message: '', type: '', stackTrace: [] },
              status: 'SUCCESS',
              createdAt: 1620232011451,
              memory: '70/128 MB',
              duration: '53.40 ms',
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: { headers: {} } as InternalAxiosRequestConfig,
          }) as HubSpotPromise<FunctionLog>
      );
      const tailCall = vi.fn(() =>
        Promise.resolve({
          data: {
            results: [],
            paging: {
              next: {
                after: 'somehash',
              },
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} } as InternalAxiosRequestConfig,
        } as unknown as HubSpotPromise<GetFunctionLogsResponse>)
      );

      // @ts-ignore - headers is not used in the actual function and does not need to be mocked
      const tailPromise = tailLogs(
        ACCOUNT_ID,
        'name',
        fetchLatest,
        tailCall,
        compact
      );
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchLatest).toHaveBeenCalled();
      expect(tailCall).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(tailCall).toHaveBeenCalledTimes(2);

      terminateTailLogs();
      await tailPromise;
    });
    it('outputs results', async () => {
      const compact = false;

      const fetchLatest = vi.fn(
        () =>
          Promise.resolve({
            data: {
              id: '1234',
              executionTime: 510,
              log: 'Log message',
              error: {
                message: '',
                type: '',
                stackTrace: [],
                statusCode: null,
              },
              status: 'SUCCESS',
              createdAt: 1620232011451,
              memory: '70/128 MB',
              duration: '53.40 ms',
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: { headers: {} } as InternalAxiosRequestConfig,
          }) as HubSpotPromise<FunctionLog>
      );
      const latestLogResponse = {
        results: [
          {
            id: '456',
            executionTime: 510,
            log: 'Message 1',
            error: null,
            status: 'SUCCESS',
            createdAt: 1620232011451,
            memory: '70/128 MB',
            duration: '53.40 ms',
          },
          {
            id: '457',
            executionTime: 510,
            log: 'Message 2',
            error: null,
            status: 'SUCCESS',
            createdAt: 1620232011451,
            memory: '70/128 MB',
            duration: '53.40 ms',
          },
        ],
        paging: {
          next: {
            after: 'somehash',
          },
        },
      };
      const tailCall = vi.fn(() =>
        Promise.resolve({
          data: latestLogResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} } as InternalAxiosRequestConfig,
        } as unknown as HubSpotPromise<GetFunctionLogsResponse>)
      );

      // @ts-ignore - headers is not used in the actual function and does not need to be mocked
      const tailPromise = tailLogs(
        ACCOUNT_ID,
        'name',
        fetchLatest,
        tailCall,
        compact
      );
      await vi.advanceTimersByTimeAsync(0);

      expect(outputLogs).toHaveBeenCalledWith(
        latestLogResponse,
        expect.objectContaining({ compact })
      );
      expect(tailCall).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(tailCall).toHaveBeenCalledTimes(2);

      terminateTailLogs();
      await tailPromise;
    });
    it('handles no logs', async () => {
      const compact = false;

      const fetchLatest = vi.fn(() => {
        return Promise.reject({
          message: '',
          type: '',
          stackTrace: [],
          statusCode: 404,
        });
      });
      const tailCall = vi.fn(() =>
        Promise.reject({
          message: '',
          type: '',
          stackTrace: [],
          statusCode: 404,
        })
      );

      await tailLogs(ACCOUNT_ID, 'name', fetchLatest, tailCall, compact);
      expect(tailCall).toHaveBeenCalledTimes(1);
    });
  });
});
