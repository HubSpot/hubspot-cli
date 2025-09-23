import mockStdIn from 'mock-stdin';
import { outputLogs } from '../ui/serverlessFunctionLogs.js';
import { tailLogs } from '../serverlessLogs.js';

vi.mock('../ui/serverlessFunctionLogs');
vi.mock('@hubspot/local-dev-lib/logger');
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
vi.useFakeTimers();

const ACCOUNT_ID = 123;

describe('lib/serverlessLogs', () => {
  describe('tailLogs()', () => {
    let stdinMock: mockStdIn.MockSTDIN;

    beforeEach(() => {
      // @ts-ignore - we don't need to mock the entire process object
      vi.spyOn(process, 'exit').mockImplementation(() => {});
      stdinMock = mockStdIn.stdin();
    });

    afterEach(() => {
      vi.clearAllTimers();
      stdinMock.restore();
    });

    it('calls tailCall() to get the next results', async () => {
      const compact = false;
      const fetchLatest = vi.fn(() => {
        return Promise.resolve({
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
          config: {},
        });
      });
      const tailCall = vi.fn(() => {
        return Promise.resolve({
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
          config: {},
        });
      });

      // @ts-ignore - headers is not used in the actual function and does not need to be mocked
      await tailLogs(ACCOUNT_ID, 'name', fetchLatest, tailCall, compact);
      vi.runOnlyPendingTimers();

      expect(fetchLatest).toHaveBeenCalled();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
    it('outputs results', async () => {
      const compact = false;

      const fetchLatest = vi.fn(() => {
        return Promise.resolve({
          data: {
            id: '1234',
            executionTime: 510,
            log: 'Log message',
            error: { message: '', type: '', stackTrace: [], statusCode: null },
            status: 'SUCCESS',
            createdAt: 1620232011451,
            memory: '70/128 MB',
            duration: '53.40 ms',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });
      });
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
        Promise.resolve({ data: latestLogResponse })
      );

      // @ts-ignore - headers is not used in the actual function and does not need to be mocked
      await tailLogs(ACCOUNT_ID, 'name', fetchLatest, tailCall, compact);
      vi.runOnlyPendingTimers();
      expect(outputLogs).toHaveBeenCalledWith(
        latestLogResponse,
        expect.objectContaining({ compact })
      );
      expect(tailCall).toHaveBeenCalledTimes(2);
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
      vi.runOnlyPendingTimers();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
  });
});
