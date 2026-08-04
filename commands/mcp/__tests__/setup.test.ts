import { Argv } from 'yargs';
import setupCommand from '../setup.js';
import { configureMcpServer } from '../../../lib/mcp/setup.js';
import { commands } from '../../../lang/en.js';

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
    let checkFn: (argv: Record<string, unknown>) => boolean;

    beforeEach(() => {
      mockYargs.check.mockClear();
      setupCommand.builder(mockYargs as unknown as Argv);
      checkFn = mockYargs.check.mock.calls[0][0];
    });

    it('should be defined as a function', () => {
      expect(setupCommand.builder).toBeDefined();
      expect(typeof setupCommand.builder).toBe('function');
    });

    it('should reject --cli-version without --standalone', () => {
      expect(() => checkFn({ cliVersion: '8.0.1' })).toThrow(
        commands.mcp.setup.errors.cliVersionRequiresStandalone
      );
    });

    it('should reject --cli-version with --no-standalone', () => {
      expect(() => checkFn({ cliVersion: '8.0.1', standalone: false })).toThrow(
        commands.mcp.setup.errors.cliVersionRequiresStandalone
      );
    });

    it('should allow --cli-version with --standalone', () => {
      expect(checkFn({ cliVersion: '8.0.1', standalone: true })).toBe(true);
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

      expect(mockedConfigureMcpServer).toHaveBeenCalledWith({
        targets: ['cursor'],
        standalone: undefined,
        cliVersion: undefined,
      });
      expect(exit).toHaveBeenCalledWith(0);
    });

    it('passes standalone and cliVersion flags to configureMcpServer', async () => {
      mockedConfigureMcpServer.mockResolvedValueOnce(['cursor']);
      const exit = vi.fn().mockResolvedValue(undefined);

      await setupCommand.handler({
        _: ['mcp', 'setup'],
        $0: 'hs',
        client: ['cursor'],
        standalone: true,
        cliVersion: '8.0.1',
        derivedAccountId: 123,
        d: false,
        debug: false,
        exit,
        addUsageMetadata: vi.fn(),
      });

      expect(mockedConfigureMcpServer).toHaveBeenCalledWith({
        targets: ['cursor'],
        standalone: true,
        cliVersion: '8.0.1',
      });
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
