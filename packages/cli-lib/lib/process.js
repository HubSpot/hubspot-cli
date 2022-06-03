const readline = require('readline');

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
  terminationSignals.forEach(signal => {
    process.removeAllListeners(signal);

    process.on(signal, async () => {
      await callback();
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
