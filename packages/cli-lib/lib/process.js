const handleExit = callback => {
  process.on('exit', callback);
  process.on('SIGINT', callback);
};

module.exports = {
  handleExit,
};
