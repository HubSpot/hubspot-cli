// @ts-nocheck
const {
  installPackages,
  getProjectPackageJsonLocations,
} = require('../../lib/dependencyManagement');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getProjectConfig } = require('../../lib/projects');
const { promptUser } = require('../../lib/prompts/promptUtils');
const path = require('path');
const { i18n } = require('../../lib/lang');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiBetaTag } = require('../../lib/ui');


exports.command = 'install-deps [packages..]';
exports.describe = uiBetaTag(i18n(`commands.project.subcommands.installDeps.help.describe`), false);

exports.handler = async options => {
  const { derivedAccountId, packages } = options || {};
  try {
    trackCommandUsage('project-install-deps', null, derivedAccountId);

    const projectConfig = await getProjectConfig();
    if (!projectConfig || !projectConfig.projectDir) {
      logger.error(i18n(`commands.project.subcommands.installDeps.noProjectConfig`));
      return process.exit(EXIT_CODES.ERROR);
    }

    const { projectDir } = projectConfig;

    let installLocations = await getProjectPackageJsonLocations();
    if (packages) {
      const { selectedInstallLocations } = await promptUser([
        {
          name: 'selectedInstallLocations',
          type: 'checkbox',
          when: () => packages && packages.length > 0,
          message: i18n(`commands.project.subcommands.installDeps.installLocationPrompt`),
          choices: installLocations.map(dir => ({
            name: path.relative(projectDir, dir),
            value: dir,
          })),
          validate: choices => {
            if (choices === undefined || choices.length === 0) {
              return i18n(`commands.project.subcommands.installDeps.installLocationPromptRequired`);
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
  } catch (e) {
    logger.debug(e);
    logger.error(e.message);
    return process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.example([
    ['$0 project install-deps', i18n(`commands.project.subcommands.installDeps.help.installAppDepsExample`)],
    [
      '$0 project install-deps dependency1 dependency2',
      i18n(`commands.project.subcommands.installDeps.help.addDepToSubComponentExample`),
    ],
  ]);
};
