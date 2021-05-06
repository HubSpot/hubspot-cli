const mockStdIn = require('mock-stdin');
const { tailLogs } = require('../serverlessLogs');

jest.mock('@hubspot/cli-lib/lib/logs');

jest.useFakeTimers();

describe('@hubspot/cli/lib/serverlessLogs', () => {
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
      const accountId = 123;
      const compact = false;
      const spinner = {
        start: jest.fn(),
        stop: jest.fn(),
        clear: jest.fn(),
      };

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
        accountId,
        compact,
        spinner,
        fetchLatest,
        tailCall,
      });
      jest.runOnlyPendingTimers();

      expect(fetchLatest).toHaveBeenCalled();
      expect(tailCall).toHaveBeenCalledTimes(2);
    });
  });
});
