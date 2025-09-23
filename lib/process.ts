import readline from 'readline';
import { logger, setLogLevel, LOG_LEVEL } from '@hubspot/local-dev-lib/logger';
import { i18n } from './lang.js';
import { logError } from './errorHandlers/index.js';

interface KeyPress {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  name?: string;
}

const SIGHUP = 'SIGHUP';
const uncaughtException = 'uncaughtException';

export const TERMINATION_SIGNALS = [
  'beforeExit',
  'SIGINT', // Terminal trying to interrupt (Ctrl + C)
  'SIGUSR1', // Start Debugger User-defined signal 1
  'SIGUSR2', // User-defined signal 2
  uncaughtException,
  'SIGTERM', // Represents a graceful termination
  SIGHUP, // Parent terminal has been closed
];

export function handleExit(
  callback: (onTerminate: { isSIGHUP: boolean }) => void
): void {
  let exitInProgress = false;

  TERMINATION_SIGNALS.forEach(signal => {
    process.removeAllListeners(signal);

    process.on(signal, async (...args: unknown[]) => {
      // Prevent duplicate exit handling
      if (!exitInProgress) {
        exitInProgress = true;
        const isSIGHUP = signal === SIGHUP;

        // Prevent logs when terminal closes
        if (isSIGHUP) {
          setLogLevel(LOG_LEVEL.NONE);
        }

        logger.debug(i18n(`lib.process.exitDebug`, { signal }));

        if (signal === uncaughtException && args && args.length > 0) {
          try {
            logError(args[0]);
          } catch (e) {
            logger.error(args[0]);
          }
        }

        await callback({ isSIGHUP });
      }
    });
  });
}

export function handleKeypress(callback: (onKeyPress: KeyPress) => void): void {
  readline.createInterface(process.stdin, process.stdout);
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.removeAllListeners('keypress');

  process.stdin.on('keypress', (str: string, key: KeyPress): void => {
    if (key) {
      callback(key);
    }
  });
}
