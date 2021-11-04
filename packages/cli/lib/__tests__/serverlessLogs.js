const mockStdIn = require('mock-stdin');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const { tailLogs } = require('../serverlessLogs');

jest.mock('@hubspot/cli-lib/lib/logs');

jest.useFakeTimers();

const ACCOUNT_ID = 123;

describe('@hubspot/cli/lib/serverlessLogs', () => {
  describe('tailLogs()', () => {
    let stdinMock;
    let spinnies;

    beforeEach(() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});
      stdinMock = mockStdIn.stdin();
      spinnies = {
        succeed: jest.fn(),
        fail: jest.fn(),
        stopAll: jest.fn(),
      };
    });

    afterEach(() => {
      jest.clearAllTimers();
      stdinMock.restore();
    });

    it('calls tailCall() to get the next results', async () => {
      const compact = false;
      const fetchLatest = jest.fn(() => {
        return Promise.resolve({
          id: '1234',
          executionTime: 510,
          log: 'Log message',
          error: null,
          status: 'SUCCESS',
          createdAt: 1620232011451,
          memory: '70/128 MB',
          duration: '53.40 ms',
        });
      });
      const tailCall = jest.fn(() => {
        return Promise.resolve({
          results: [],
          paging: {
            next: {
              after: 'somehash',
            },
          },
        });
      });

      await tailLogs({
        accountId: ACCOUNT_ID,
        compact,
        spinnies,
        fetchLatest,
        tailCall,
      });
      jest.runOnlyPendingTimers();

      expect(fetchLatest).toHaveBeenCalled();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
    it('outputs results', async () => {
      const compact = false;

      const fetchLatest = jest.fn(() => {
        return Promise.resolve({
          id: '1234',
          executionTime: 510,
          log: 'Log message',
          error: null,
          status: 'SUCCESS',
          createdAt: 1620232011451,
          memory: '70/128 MB',
          duration: '53.40 ms',
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
      const tailCall = jest.fn(() => Promise.resolve(latestLogResponse));

      await tailLogs({
        accountId: ACCOUNT_ID,
        compact,
        spinnies,
        fetchLatest,
        tailCall,
      });
      jest.runOnlyPendingTimers();
      expect(outputLogs).toHaveBeenCalledWith(
        latestLogResponse,
        expect.objectContaining({ compact })
      );
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
    it('handles no logs', async () => {
      const compact = false;

      const fetchLatest = jest.fn(() => {
        return Promise.reject(
          new Error({
            statusCode: 404,
          })
        );
      });
      const tailCall = jest.fn(() =>
        Promise.reject(
          new Error({
            statusCode: 404,
          })
        )
      );

      await tailLogs({
        accountId: ACCOUNT_ID,
        compact,
        spinnies,
        fetchLatest,
        tailCall,
      });
      jest.runOnlyPendingTimers();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
  });
});
