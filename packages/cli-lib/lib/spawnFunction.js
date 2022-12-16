const cp = require('child_process');

const spawn = codeToExec => {
  // TODO: Sanitize input here, probably.
  const child = cp.spawnSync('node', ['-e', codeToExec], {
    stdio: 'inherit',
  });

  return child;
};

module.exports = spawn;
