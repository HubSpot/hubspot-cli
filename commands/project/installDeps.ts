import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  installPackages,
  getProjectPackageJsonLocations,
} from '../../lib/dependencyManagement.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import path from 'path';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'install-deps [packages..]';
const describe = commands.project.installDeps.help.describe;

export type ProjectInstallDepsArgs = CommonArgs & {
  packages?: string[];
};

async function handler(
  args: ArgumentsCamelCase<ProjectInstallDepsArgs>
): Promise<void> {
  const { derivedAccountId, packages } = args;
  try {
    trackCommandUsage('project-install-deps', undefined, derivedAccountId);

    const projectConfig = await getProjectConfig();
    if (!projectConfig || !projectConfig.projectDir) {
      uiLogger.error(commands.project.installDeps.noProjectConfig);
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
          message: commands.project.installDeps.installLocationPrompt,
          choices: installLocations.map(dir => ({
            name: path.relative(projectDir, dir),
            value: dir,
          })),
          validate: (choices: string[]) => {
            if (choices === undefined || choices.length === 0) {
              return commands.project.installDeps.installLocationPromptRequired;
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
      commands.project.installDeps.help.installAppDepsExample,
    ],
    [
      '$0 project install-deps dependency1 dependency2',
      commands.project.installDeps.help.addDepToSubComponentExample,
    ],
  ]);

  return yargs as Argv<ProjectInstallDepsArgs>;
}

const builder = makeYargsBuilder<ProjectInstallDepsArgs>(
  projectInstallDepsBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const projectInstallDepsCommand: YargsCommandModule<
  unknown,
  ProjectInstallDepsArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default projectInstallDepsCommand;
