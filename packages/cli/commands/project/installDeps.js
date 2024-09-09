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
const { getAccountId } = require('../../lib/commonOpts');

const i18nKey = `commands.project.subcommands.installDeps`;

exports.command = 'install-deps [packages..]';
// Intentionally making this null to hide command
exports.describe = null;
// exports.describe = uiBetaTag(i18n(`${i18nKey}.help.describe`), false);

exports.handler = async ({ packages }) => {
  try {
    const accountId = getAccountId();
    trackCommandUsage('project-install-deps', null, accountId);

    const projectConfig = await getProjectConfig();
    if (!projectConfig || !projectConfig.projectDir) {
      logger.error(i18n(`${i18nKey}.noProjectConfig`));
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
          message: i18n(`${i18nKey}.installLocationPrompt`),
          choices: installLocations.map(dir => ({
            name: path.relative(projectDir, dir),
            value: dir,
          })),
          validate: choices => {
            if (choices === undefined || choices.length === 0) {
              return i18n(`${i18nKey}.installLocationPromptRequired`);
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
    ['$0 project install-deps', i18n(`${i18nKey}.help.installAppDepsExample`)],
    [
      '$0 project install-deps dependency1 dependency2',
      i18n(`${i18nKey}.help.addDepToSubComponentExample`),
    ],
  ]);
};
