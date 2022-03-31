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
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

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
