import { getRoutes } from '@hubspot/local-dev-lib/api/functions';
import { uiLogger } from '../../../../lib/ui/logger.js';
import listCommand from '../list.js';

vi.mock('@hubspot/local-dev-lib/api/functions');
vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../ui/render.js', () => ({ renderTable: vi.fn() }));

const processExitSpy = vi.spyOn(process, 'exit');
const mockedGetRoutes = vi.mocked(getRoutes);

type ListHandlerArgs = Parameters<typeof listCommand.handler>[0];

async function runHandler(json = false): Promise<void> {
  await listCommand.handler({
    _: ['cms', 'function', 'list'],
    derivedAccountId: 123456,
    json,
  } as unknown as ListHandlerArgs);
}

function getLoggedMessages(): string {
  return vi
    .mocked(uiLogger.log)
    .mock.calls.map(call => String(call[0]))
    .join('\n');
}

describe('commands/cms/function/list', () => {
  describe('describe', () => {
    it('should mark the command as deprecated', () => {
      expect(listCommand.describe).toContain('[DEPRECATED]');
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
      mockedGetRoutes.mockResolvedValue({
        data: { objects: [] },
      } as unknown as Awaited<ReturnType<typeof getRoutes>>);
    });

    it('should log a deprecation notice with the sunset dates and still list the functions', async () => {
      await runHandler();

      const message = getLoggedMessages();

      expect(message).toContain('[DEPRECATED]');
      expect(message).toContain('hs cms function list');
      expect(message).toContain('November 17, 2026');
      expect(message).toContain('February 1, 2027');
      expect(message).toContain('Developer Changelog');
      expect(mockedGetRoutes).toHaveBeenCalledTimes(1);
    });

    it('should not log the notice with --json so the output stays valid JSON', async () => {
      mockedGetRoutes.mockResolvedValue({
        data: { objects: [{ id: 'route-1' }] },
      } as unknown as Awaited<ReturnType<typeof getRoutes>>);

      await runHandler(true);

      expect(getLoggedMessages()).not.toContain('[DEPRECATED]');
      expect(uiLogger.json).toHaveBeenCalledTimes(1);
    });
  });
});
