import { uiLogger } from '../../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import createCommand from '../create.js';

vi.mock('../../../../lib/commonOpts');

const processExitSpy = vi.spyOn(process, 'exit');

type CreateHandlerArgs = Parameters<typeof createCommand.handler>[0];

async function runHandler(): Promise<void> {
  await createCommand.handler({
    _: ['cms', 'function', 'create'],
    name: 'my-function',
    dest: 'my-dest',
  } as unknown as CreateHandlerArgs);
}

function getLoggedMessages(): string {
  return vi
    .mocked(uiLogger.error)
    .mock.calls.map(call => String(call[0]))
    .join('\n');
}

describe('commands/cms/function/create', () => {
  describe('describe', () => {
    it('should mark the command as deprecated and say creating functions has ended', () => {
      expect(createCommand.describe).toContain('[DEPRECATED]');
      expect(createCommand.describe).toContain(
        'Creating serverless functions has ended.'
      );
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
    });

    it('should log the disabled banner and exit with an error', async () => {
      await runHandler();

      const message = getLoggedMessages();

      expect(message).toContain('hs cms function create');
      expect(message).toContain('disabled');
      expect(message).toContain('can no longer be created');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should mention the sunset dates and link the Developer Changelog', async () => {
      await runHandler();

      const message = getLoggedMessages();

      expect(message).toContain('November 17, 2026');
      expect(message).toContain('February 1, 2027');
      expect(message).toContain('Developer Changelog');
    });
  });
});
