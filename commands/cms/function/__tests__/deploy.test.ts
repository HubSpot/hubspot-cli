import { buildPackage } from '@hubspot/local-dev-lib/api/functions';
import { uiLogger } from '../../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import deployCommand from '../deploy.js';

vi.mock('@hubspot/local-dev-lib/api/functions');
vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/ui/SpinniesManager.js');
vi.mock('../../../../lib/ui/index.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../lib/ui/index.js')
  >('../../../../lib/ui/index.js');
  return { ...actual, uiAccountDescription: vi.fn().mockReturnValue('123456') };
});
vi.mock('../../../../lib/errorHandlers/index.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../lib/errorHandlers/index.js')
  >('../../../../lib/errorHandlers/index.js');
  return { ...actual, logError: vi.fn() };
});

const processExitSpy = vi.spyOn(process, 'exit');
const mockedBuildPackage = vi.mocked(buildPackage);

type DeployHandlerArgs = Parameters<typeof deployCommand.handler>[0];

async function runHandler(): Promise<void> {
  await deployCommand.handler({
    _: ['cms', 'function', 'deploy'],
    path: 'my-function.functions',
    derivedAccountId: 123456,
  } as unknown as DeployHandlerArgs);
}

function getLoggedMessages(): string {
  return vi
    .mocked(uiLogger.log)
    .mock.calls.map(call => String(call[0]))
    .join('\n');
}

describe('commands/cms/function/deploy', () => {
  describe('describe', () => {
    it('should stay hidden from help', () => {
      expect(deployCommand.describe).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
      mockedBuildPackage.mockRejectedValue(new Error('rejected'));
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log a deprecation notice with the sunset dates and still attempt the deploy before November 17, 2026 UTC', async () => {
      vi.setSystemTime(new Date('2026-11-16T23:59:59Z'));

      await runHandler();

      const message = getLoggedMessages();

      expect(message).toContain('[DEPRECATED]');
      expect(message).toContain('hs cms function deploy');
      expect(message).toContain('November 17, 2026');
      expect(message).toContain('February 1, 2027');
      expect(message).toContain('Developer Changelog');
      expect(mockedBuildPackage).toHaveBeenCalledTimes(1);
    });

    it('should log the disabled banner and exit with an error on and after November 17, 2026 UTC', async () => {
      vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));

      await runHandler();

      const message = vi
        .mocked(uiLogger.error)
        .mock.calls.map(call => String(call[0]))
        .join('\n');

      expect(message).toContain('hs cms function deploy');
      expect(message).toContain('disabled');
      expect(message).toContain('can no longer be created or edited');
      expect(message).toContain('February 1, 2027');
      expect(mockedBuildPackage).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
