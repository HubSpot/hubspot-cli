const readline = require('readline');
const { logger } = require('@hubspot/cli-lib/logger');

const handleExit = callback => {
  const terminationSignals = [
    'beforeExit',
    'SIGINT',
    'SIGUSR1',
    'SIGUSR2',
    'uncaughtException',
    'SIGTERM',
    'SIGHUP',
  ];
  let exitInProgress = false;

  terminationSignals.forEach(signal => {
    process.removeAllListeners(signal);

    process.on(signal, async () => {
      logger.debug(`Attempting to gracefully exit. Triggered by ${signal}`);
      // Prevent duplicate exit handling
      if (!exitInProgress) {
        exitInProgress = true;
        await callback();
      }
    });
  });
};

const handleKeypress = callback => {
  readline.createInterface(process.stdin, process.stdout);
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.removeAllListeners('keypress');

  process.stdin.on('keypress', (str, key) => {
    if (key) {
      callback(key);
    }
  });
};

module.exports = {
  handleExit,
  handleKeypress,
};
