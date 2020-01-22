const { execSync } = require('child_process');

function canUseYarn() {
  try {
    execSync('yarn -v', { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  canUseYarn,
};
