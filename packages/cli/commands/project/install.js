const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('../../lib/projects');
const path = require('node:path');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { execSync } = require('child_process');
exports.command = 'install';
exports.describe = 'Install your deps';

exports.handler = async () => {
  const {
    projectDir,
    projectConfig: { srcDir },
  } = await getProjectConfig();
  const projectSrcDir = path.join(projectDir, srcDir);
  const packageJsonFiles = (await walk(projectSrcDir)).filter(
    file =>
      file.includes('package.json') &&
      !file.includes('node_modules') &&
      !file.includes('.vite')
  );

  packageJsonFiles.forEach(file => {
    const directory = path.dirname(file);
    logger.info(`Installing dependencies for ${directory}`);
    execSync(`npm --prefix=${directory} install`, { stdio: 'inherit' });
  });
};

exports.builder = yargs => {
  return yargs;
};
