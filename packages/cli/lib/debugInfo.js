const { version } = require('../package.json');
const { getPlatform } = require('./environment');

const logDebugInfo = ({ debug }) => {
  if (!debug) {
    return;
  }
  console.log('');
  console.log('Debugging info');
  console.log('==============');
  console.log(`CLI version: ${version}`);
  console.log(`node version: ${process.version}`);
  console.log(`platform: ${getPlatform()}`);
  console.log('');
};

module.exports = {
  logDebugInfo,
};
