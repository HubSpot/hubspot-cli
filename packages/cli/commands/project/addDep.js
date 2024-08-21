const { getProjectConfig } = require('../../lib/projects');
const path = require('node:path');
const { promptUser } = require('../../lib/prompts/promptUtils');
const {
  installDeps,
  getProjectPackageJsonFiles,
} = require('../../lib/dependencyManagement');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { logger } = require('@hubspot/local-dev-lib/logger');

exports.command = 'add-dep [packages..]';
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

    const packageParentDirs = await getProjectPackageJsonFiles();
    const { installLocations } = await promptUser([
      {
        name: 'installLocations',
        type: 'checkbox',
        when: () => packages && packages.length > 0,
        message: `Which location would you like to add the dependencies to?`,
        choices: packageParentDirs.map(dir => ({
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

    await installDeps({ packages, installLocations });
  } catch (e) {
    logger.error(e.message);
    process.exit(EXIT_CODES.ERROR);
  }
};
