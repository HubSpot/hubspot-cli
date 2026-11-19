import { uiLogger } from '../../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import { startServerlessDevRuntime } from '../../../../lib/cms/serverlessDevRuntime.js';
import serverCommand from '../server.js';

vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/cms/serverlessDevRuntime.js');

const processExitSpy = vi.spyOn(process, 'exit');
const mockedStartServerlessDevRuntime = vi.mocked(startServerlessDevRuntime);

type ServerHandlerArgs = Parameters<typeof serverCommand.handler>[0];

async function runHandler(): Promise<void> {
  await serverCommand.handler({
    _: ['cms', 'function', 'server'],
    path: 'my-function.functions',
    derivedAccountId: 123456,
  } as unknown as ServerHandlerArgs);
}

function getLoggedMessages(): string {
  return vi
    .mocked(uiLogger.log)
    .mock.calls.map(call => String(call[0]))
    .join('\n');
}

describe('commands/cms/function/server', () => {
  describe('describe', () => {
    it('should stay hidden from help', () => {
      expect(serverCommand.describe).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
      mockedStartServerlessDevRuntime.mockResolvedValue(undefined);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log a deprecation notice with the sunset dates and still start the server before November 17, 2026 UTC', async () => {
      vi.setSystemTime(new Date('2026-11-16T23:59:59Z'));

      await runHandler();

      const message = getLoggedMessages();

      expect(message).toContain('[DEPRECATED]');
      expect(message).toContain('hs cms function server');
      expect(message).toContain('November 17, 2026');
      expect(message).toContain('February 1, 2027');
      expect(message).toContain('Developer Changelog');
      expect(mockedStartServerlessDevRuntime).toHaveBeenCalledTimes(1);
    });

    it('should log the disabled banner and exit with an error on and after November 17, 2026 UTC', async () => {
      vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));

      await runHandler();

      const message = vi
        .mocked(uiLogger.error)
        .mock.calls.map(call => String(call[0]))
        .join('\n');

      expect(message).toContain('hs cms function server');
      expect(message).toContain('disabled');
      expect(message).toContain('can no longer be created or edited');
      expect(message).toContain('February 1, 2027');
      expect(mockedStartServerlessDevRuntime).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
