import readline from 'readline';
import { logger, setLogLevel, LOG_LEVEL } from '@hubspot/local-dev-lib/logger';
import { handleExit, handleKeypress, TERMINATION_SIGNALS } from '../process.js';
import { Mock, Mocked } from 'vitest';

vi.mock('readline');
vi.mock('@hubspot/local-dev-lib/logger');

const mockedReadline = readline as Mocked<typeof readline>;
const mockedLogger = logger as Mocked<typeof logger>;
const mockedSetLogLevel = setLogLevel as Mock;
const processRemoveListenerSpy = vi.spyOn(process, 'removeAllListeners');
const processOnSpy = vi.spyOn(process, 'on');

describe('lib/process', () => {
  describe('handleExit()', () => {
    const mockCallback = vi.fn();

    it('should set up listeners for all termination signals', () => {
      handleExit(mockCallback);

      TERMINATION_SIGNALS.forEach(signal => {
        expect(processRemoveListenerSpy).toHaveBeenCalledWith(signal);
        expect(processOnSpy).toHaveBeenCalledWith(signal, expect.any(Function));
      });
    });

    it('should handle SIGHUP signal correctly', async () => {
      handleExit(mockCallback);

      // Get the callback function passed to process.on for SIGHUP
      const sighupCallback = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGHUP'
      )?.[1];

      expect(sighupCallback).toBeDefined();

      sighupCallback!();

      expect(mockedSetLogLevel).toHaveBeenCalledWith(LOG_LEVEL.NONE);
      expect(mockCallback).toHaveBeenCalledWith({ isSIGHUP: true });
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SIGHUP')
      );
    });

    it('should handle non-SIGHUP signals correctly', async () => {
      handleExit(mockCallback);

      // Get the callback function passed to process.on for SIGINT
      const sigintCallback = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGINT'
      )?.[1];

      expect(sigintCallback).toBeDefined();

      sigintCallback!();

      expect(mockedSetLogLevel).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({ isSIGHUP: false });
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SIGINT')
      );
    });

    it('should prevent duplicate exit handling', async () => {
      handleExit(mockCallback);

      // Get the callback function passed to process.on for SIGINT
      const sigintCallback = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGINT'
      )?.[1];

      expect(sigintCallback).toBeDefined();

      sigintCallback!();
      sigintCallback!(); // Second call should be ignored

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleKeypress()', () => {
    const mockCallback = vi.fn();

    it('should set up keypress handling correctly', () => {
      // Mock process.stdin
      Object.defineProperty(process, 'stdin', {
        value: {
          isTTY: true,
          setRawMode: vi.fn(),
          on: vi.fn(),
          removeAllListeners: vi.fn(),
        },
      });

      mockedReadline.createInterface.mockReturnValue({} as readline.Interface);
      mockedReadline.emitKeypressEvents.mockImplementation(() => {});

      handleKeypress(mockCallback);

      expect(mockedReadline.createInterface).toHaveBeenCalledWith(
        process.stdin,
        process.stdout
      );
      expect(mockedReadline.emitKeypressEvents).toHaveBeenCalledWith(
        process.stdin
      );
      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(process.stdin.removeAllListeners).toHaveBeenCalledWith('keypress');
      expect(process.stdin.on).toHaveBeenCalledWith(
        'keypress',
        expect.any(Function)
      );
    });

    it('should not set raw mode when stdin is not TTY', () => {
      // Mock process.stdin as non-TTY
      Object.defineProperty(process, 'stdin', {
        value: {
          isTTY: false,
          on: vi.fn(),
          removeAllListeners: vi.fn(),
        },
      });

      handleKeypress(mockCallback);

      expect(process.stdin.setRawMode).toBeUndefined();
    });
  });
});
