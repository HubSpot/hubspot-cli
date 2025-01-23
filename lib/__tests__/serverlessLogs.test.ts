// @ts-nocheck
const mockStdIn = require('mock-stdin');
const { outputLogs } = require('../ui/serverlessFunctionLogs');
const { tailLogs } = require('../serverlessLogs');

jest.mock('../ui/serverlessFunctionLogs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.useFakeTimers();

const ACCOUNT_ID = 123;

describe('lib/serverlessLogs', () => {
  describe('tailLogs()', () => {
    let stdinMock;

    beforeEach(() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {});
      stdinMock = mockStdIn.stdin();
    });

    afterEach(() => {
      jest.clearAllTimers();
      stdinMock.restore();
    });

    it('calls tailCall() to get the next results', async () => {
      const compact = false;
      const fetchLatest = jest.fn(() => {
        return Promise.resolve({
          data: {
            id: '1234',
            executionTime: 510,
            log: 'Log message',
            error: null,
            status: 'SUCCESS',
            createdAt: 1620232011451,
            memory: '70/128 MB',
            duration: '53.40 ms',
          },
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

      await tailLogs(ACCOUNT_ID, 'name', fetchLatest, tailCall, compact);
      jest.runOnlyPendingTimers();

      expect(fetchLatest).toHaveBeenCalled();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
    it('outputs results', async () => {
      const compact = false;

      const fetchLatest = jest.fn(() => {
        return Promise.resolve({
          data: {
            id: '1234',
            executionTime: 510,
            log: 'Log message',
            error: null,
            status: 'SUCCESS',
            createdAt: 1620232011451,
            memory: '70/128 MB',
            duration: '53.40 ms',
          },
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
      const tailCall = jest.fn(() =>
        Promise.resolve({ data: latestLogResponse })
      );

      await tailLogs(ACCOUNT_ID, 'name', fetchLatest, tailCall, compact);
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

      await tailLogs(ACCOUNT_ID, 'name', fetchLatest, tailCall, compact);
      jest.runOnlyPendingTimers();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
  });
});
