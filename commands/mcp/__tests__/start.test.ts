import { ArgumentsCamelCase } from 'yargs';
import { spawn } from 'node:child_process';
import fs from 'fs';
import { EventEmitter } from 'events';
import * as configLib from '@hubspot/local-dev-lib/config';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as errorHandlers from '../../../lib/errorHandlers/index.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as processLib from '../../../lib/process.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

// Create a mock execAsync function before importing the module
const execAsyncMock = vi.fn();

vi.mock('yargs');
vi.mock('../../../lib/commonOpts');
vi.mock('node:child_process');
vi.mock('node:util', () => ({
  promisify: vi.fn(() => execAsyncMock),
}));
vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/process.js');

// Import after mocks are set up
const startCommand = await import('../start.js').then(m => m.default);

const spawnSpy = vi.mocked(spawn);
const existsSyncSpy = vi.spyOn(fs, 'existsSync');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const handleExitSpy = vi.spyOn(processLib, 'handleExit');
const logErrorSpy = vi.spyOn(errorHandlers, 'logError');
const processExitSpy = vi.spyOn(process, 'exit');
const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);

class MockChildProcess extends EventEmitter {
  kill = vi.fn();
}

describe('commands/mcp/start', () => {
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    mockChildProcess = new MockChildProcess();
    // @ts-expect-error Mock implementation
    spawnSpy.mockReturnValue(mockChildProcess);
    existsSyncSpy.mockReturnValue(true);
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    // Mock config to prevent reading actual config file in CI
    getConfigAccountIfExistsSpy.mockReturnValue(undefined);
    execAsyncMock.mockClear();
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(startCommand.command).toEqual('start');
    });
  });

  describe('describe', () => {
    it('should be undefined to keep the command hidden', () => {
      expect(startCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should be defined as a function', () => {
      expect(startCommand.builder).toBeDefined();
      expect(typeof startCommand.builder).toBe('function');
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<{
      aiAgent?: string;
      derivedAccountId: number;
      d: boolean;
      debug: boolean;
    }>;

    beforeEach(() => {
      args = {
        aiAgent: 'test-agent',
        derivedAccountId: 123456,
        d: false,
        debug: false,
      } as ArgumentsCamelCase<{
        aiAgent?: string;
        derivedAccountId: number;
        d: boolean;
        debug: boolean;
      }>;
    });

    it('should track command usage', async () => {
      await startCommand.handler(args);

      expect(trackCommandUsageSpy).toHaveBeenCalledWith(
        'mcp-start',
        {},
        123456
      );
    });

    it('should check if server file exists', async () => {
      await startCommand.handler(args);

      expect(existsSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining('server.js')
      );
    });

    it('should error if server file does not exist', async () => {
      existsSyncSpy.mockReturnValue(false);

      await startCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(spawnSpy).not.toHaveBeenCalled();
    });

    it('should spawn server process with correct arguments', async () => {
      await startCommand.handler(args);

      expect(spawnSpy).toHaveBeenCalledWith(
        'node',
        [expect.stringContaining('server.js')],
        expect.objectContaining({
          stdio: 'inherit',
          env: expect.objectContaining({
            HUBSPOT_MCP_AI_AGENT: 'test-agent',
          }),
        })
      );
    });

    it('should use "unknown" as default AI agent', async () => {
      delete args.aiAgent;

      await startCommand.handler(args);

      expect(spawnSpy).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            HUBSPOT_MCP_AI_AGENT: 'unknown',
          }),
        })
      );
    });

    it('should log debug messages when starting', async () => {
      await startCommand.handler(args);

      expect(uiLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting')
      );
      expect(uiLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('stop')
      );
    });

    it('should handle child process errors', async () => {
      await startCommand.handler(args);

      const error = new Error('Process error');
      mockChildProcess.emit('error', error);

      expect(logErrorSpy).toHaveBeenCalledWith(error);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start')
      );
    });

    it('should handle child process close', async () => {
      await startCommand.handler(args);

      mockChildProcess.emit('close');

      expect(uiLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/stopped/i)
      );
    });

    it('should register exit handler', async () => {
      await startCommand.handler(args);

      expect(handleExitSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should kill child process on exit', async () => {
      await startCommand.handler(args);

      const exitHandler = handleExitSpy.mock.calls[0][0];
      exitHandler({ isSIGHUP: false });

      expect(uiLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Shutting')
      );
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle exceptions during server start', async () => {
      const error = new Error('Spawn failed');
      spawnSpy.mockImplementation(() => {
        throw error;
      });

      await startCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start')
      );
      expect(logErrorSpy).toHaveBeenCalledWith(error);
    });
  });
});
