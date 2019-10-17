const { execSync } = require('child_process');

module.exports = {
  defaultOptions: {
    ssh: false,
    repo: 'HubSpot/cms-theme-boilerplate',
    skipInstall: false,
  },
  get canUseYarn() {
    try {
      execSync('yarn -v', { stdio: 'inherit' });
      return true;
    } catch (err) {
      return false;
    }
  },
};
