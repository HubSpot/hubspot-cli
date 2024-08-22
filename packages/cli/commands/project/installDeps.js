const {
  installPackages,
  getProjectPackageJsonFiles,
} = require('../../lib/dependencyManagement');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getProjectConfig } = require('../../lib/projects');
const { promptUser } = require('../../lib/prompts/promptUtils');
const path = require('node:path');

exports.command = 'install-deps [packages..]';
exports.describe = 'Install your deps';
exports.builder = yargs => yargs;

exports.handler = async ({ packages }) => {
  try {
    const projectConfig = await getProjectConfig();

    if (!projectConfig || !projectConfig.projectDir) {
      logger.error('Must be ran within a project');
      process.exit(EXIT_CODES.ERROR);
    }

    const { projectDir } = projectConfig;

    let installLocations = await getProjectPackageJsonFiles();
    if (packages) {
      const { selectedInstallLocations } = await promptUser([
        {
          name: 'selectedInstallLocations',
          type: 'checkbox',
          when: () => packages && packages.length > 0,
          message: `Which location would you like to add the dependencies to?`,
          choices: installLocations.map(dir => ({
            name: path.relative(projectDir, dir),
            value: dir,
          })),
          validate: choices => {
            if (choices === undefined || choices.length === 0) {
              return 'You must choose at least one location';
            }
            return true;
          },
        },
      ]);
      if (selectedInstallLocations) {
        installLocations = selectedInstallLocations;
      }
    }

    await installPackages({
      packages,
      installLocations,
    });

    logger.success('Dependencies installed successfully');
  } catch (e) {
    logger.debug(e);
    logger.error(e.message);
    process.exit(EXIT_CODES.ERROR);
  }
};
