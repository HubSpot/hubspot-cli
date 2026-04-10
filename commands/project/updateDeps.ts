import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  updatePackages,
  getProjectPackageJsonLocations,
} from '../../lib/dependencyManagement.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { isPromptExitError } from '../../lib/errors/PromptExitError.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import path from 'path';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'update-deps [packages..]';
const describe = commands.project.updateDeps.help.describe;

export type ProjectUpdateDepsArgs = CommonArgs &
  ConfigArgs & {
    packages?: string[];
  };

async function handler(
  args: ArgumentsCamelCase<ProjectUpdateDepsArgs>
): Promise<void> {
  const { packages, exit } = args;
  try {
    const projectConfig = await getProjectConfig();
    if (!projectConfig || !projectConfig.projectDir) {
      uiLogger.error(commands.project.updateDeps.noProjectConfig);
      return exit(EXIT_CODES.ERROR);
    }

    const { projectDir } = projectConfig;

    let installLocations = await getProjectPackageJsonLocations();
    if (packages) {
      const { selectedInstallLocations } = await promptUser([
        {
          name: 'selectedInstallLocations',
          type: 'checkbox',
          when: () => packages && packages.length > 0,
          message: commands.project.updateDeps.installLocationPrompt,
          choices: installLocations.map(dir => ({
            name: path.relative(projectDir, dir),
            value: dir,
          })),
          validate: (choices: string[]) => {
            if (choices === undefined || choices.length === 0) {
              return commands.project.updateDeps.installLocationPromptRequired;
            }
            return true;
          },
        },
      ]);
      if (selectedInstallLocations) {
        installLocations = selectedInstallLocations;
      }
    }

    await updatePackages({
      packages,
      installLocations,
    });
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }
}

function projectUpdateDepsBuilder(yargs: Argv): Argv<ProjectUpdateDepsArgs> {
  yargs.example([
    [
      '$0 project update-deps',
      commands.project.updateDeps.help.updateAppDepsExample,
    ],
    [
      '$0 project update-deps dependency1 dependency2',
      commands.project.updateDeps.help.updateDepToSubComponentExample,
    ],
  ]);

  return yargs as Argv<ProjectUpdateDepsArgs>;
}

const builder = makeYargsBuilder<ProjectUpdateDepsArgs>(
  projectUpdateDepsBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const projectUpdateDepsCommand: YargsCommandModule<
  unknown,
  ProjectUpdateDepsArgs
> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('project-update-deps', handler),
  builder,
};

export default projectUpdateDepsCommand;
