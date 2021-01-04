const getPlatform = () => {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return process.platform;
  }
};

module.exports = {
  getPlatform,
};
