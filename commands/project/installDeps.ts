import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  installPackages,
  getProjectPackageJsonLocations,
} from '../../lib/dependencyManagement';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { getProjectConfig } from '../../lib/projects';
import { promptUser } from '../../lib/prompts/promptUtils';
import path from 'path';
import { i18n } from '../../lib/lang';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiBetaTag } from '../../lib/ui';
import { CommonArgs } from '../../types/Yargs';
import { logError } from '../../lib/errorHandlers';
import { makeYargsBuilder } from '../../lib/yargsUtils';

export const command = 'install-deps [packages..]';
export const describe = uiBetaTag(
  i18n(`commands.project.subcommands.installDeps.help.describe`),
  false
);

export type ProjectInstallDepsArgs = CommonArgs & {
  packages?: string[];
};

export async function handler(
  args: ArgumentsCamelCase<ProjectInstallDepsArgs>
): Promise<void> {
  const { derivedAccountId, packages } = args;
  try {
    trackCommandUsage('project-install-deps', undefined, derivedAccountId);

    const projectConfig = await getProjectConfig();
    if (!projectConfig || !projectConfig.projectDir) {
      logger.error(
        i18n(`commands.project.subcommands.installDeps.noProjectConfig`)
      );
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
          message: i18n(
            `commands.project.subcommands.installDeps.installLocationPrompt`
          ),
          choices: installLocations.map(dir => ({
            name: path.relative(projectDir, dir),
            value: dir,
          })),
          validate: choices => {
            if (choices === undefined || choices.length === 0) {
              return i18n(
                `commands.project.subcommands.installDeps.installLocationPromptRequired`
              );
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
    logError(e);
    return process.exit(EXIT_CODES.ERROR);
  }
}

function projectInstallDepsBuilder(yargs: Argv): Argv<ProjectInstallDepsArgs> {
  yargs.example([
    [
      '$0 project install-deps',
      i18n(
        `commands.project.subcommands.installDeps.help.installAppDepsExample`
      ),
    ],
    [
      '$0 project install-deps dependency1 dependency2',
      i18n(
        `commands.project.subcommands.installDeps.help.addDepToSubComponentExample`
      ),
    ],
  ]);

  return yargs as Argv<ProjectInstallDepsArgs>;
}

export const builder = makeYargsBuilder<ProjectInstallDepsArgs>(
  projectInstallDepsBuilder,
  command,
  describe
);

module.exports = {
  command,
  describe,
  builder,
  handler,
};
