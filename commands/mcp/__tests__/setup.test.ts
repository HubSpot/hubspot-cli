import setupCommand from '../setup.js';
import { configureMcpServer } from '../../../lib/mcp/setup.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/yargs/makeWrappedYargsHandler.js', () => ({
  makeWrappedYargsHandler: vi.fn((_trackingName, handler) => handler),
}));
vi.mock('../../../lib/mcp/setup.js', () => ({
  configureMcpServer: vi.fn(),
  supportedTools: [{ name: 'Cursor', value: 'cursor' }],
}));

const mockedConfigureMcpServer = vi.mocked(configureMcpServer);

describe('commands/mcp/setup', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(setupCommand.command).toEqual(['setup']);
    });
  });

  describe('describe', () => {
    it('should be defined', () => {
      expect(setupCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should be defined as a function', () => {
      expect(setupCommand.builder).toBeDefined();
      expect(typeof setupCommand.builder).toBe('function');
    });
  });

  describe('handler', () => {
    it('should be defined', () => {
      expect(setupCommand.handler).toBeDefined();
      expect(typeof setupCommand.handler).toBe('function');
    });

    it('exits successfully after setup completes', async () => {
      mockedConfigureMcpServer.mockResolvedValueOnce(['cursor']);
      const exit = vi.fn().mockResolvedValue(undefined);

      await setupCommand.handler({
        _: ['mcp', 'setup'],
        $0: 'hs',
        client: ['cursor'],
        derivedAccountId: 123,
        d: false,
        debug: false,
        exit,
        addUsageMetadata: vi.fn(),
      });

      expect(mockedConfigureMcpServer).toHaveBeenCalledWith(['cursor']);
      expect(exit).toHaveBeenCalledWith(0);
    });

    it('exits with error when setup fails', async () => {
      mockedConfigureMcpServer.mockRejectedValueOnce(new Error('setup failed'));
      const exit = vi.fn().mockResolvedValue(undefined);

      await setupCommand.handler({
        _: ['mcp', 'setup'],
        $0: 'hs',
        client: ['cursor'],
        derivedAccountId: 123,
        d: false,
        debug: false,
        exit,
        addUsageMetadata: vi.fn(),
      });

      expect(exit).toHaveBeenCalledWith(1);
    });
  });
});
