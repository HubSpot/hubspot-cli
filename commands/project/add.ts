import { Argv, ArgumentsCamelCase } from 'yargs';

import { logError } from '../../lib/errorHandlers/index.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  YargsCommandModule,
  CommonArgs,
  ConfigArgs,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { isV2Project } from '../../lib/projects/platformVersion.js';
import { legacyAddComponent } from '../../lib/projects/add/legacyAddComponent.js';
import { v2AddComponent } from '../../lib/projects/add/v2AddComponent.js';
import {
  marketplaceDistribution,
  oAuth,
  privateDistribution,
  staticAuth,
} from '../../lib/constants.js';
import { uiLogger } from '../../lib/ui/logger.js';

const command = 'add';
const describe = commands.project.add.describe;

export type ProjectAddArgs = CommonArgs &
  ConfigArgs & {
    type?: string;
    name?: string;
    features?: string[];
    distribution?: string;
    auth?: string;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectAddArgs>
): Promise<void> {
  try {
    const { derivedAccountId } = args;

    const { projectConfig, projectDir } = await getProjectConfig();

    if (!projectDir || !projectConfig) {
      uiLogger.error(commands.project.add.error.locationInProject);
      process.exit(EXIT_CODES.ERROR);
    }

    const isV2ProjectCreate = isV2Project(projectConfig.platformVersion);

    if (isV2ProjectCreate) {
      await v2AddComponent(args, projectDir, projectConfig, derivedAccountId);
    } else {
      await legacyAddComponent(
        args,
        projectDir,
        projectConfig,
        derivedAccountId
      );
    }
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function projectAddBuilder(yargs: Argv): Argv<ProjectAddArgs> {
  yargs.options({
    type: {
      describe: commands.project.add.options.type.describe,
      type: 'string',
    },
    name: {
      describe: commands.project.add.options.name.describe,
      type: 'string',
    },
    distribution: {
      describe: commands.project.add.options.distribution.describe,
      type: 'string',
      choices: [privateDistribution, marketplaceDistribution],
    },
    auth: {
      describe: commands.project.add.options.auth.describe,
      type: 'string',
      choices: [oAuth, staticAuth],
    },
    features: {
      describe: commands.project.add.options.features.describe,
      type: 'array',
    },
  });

  yargs.example([['$0 project add', commands.project.add.examples.default]]);
  yargs.example([
    [
      '$0 project add --name="my-component" --type="components/example-app"',
      commands.project.add.examples.withFlags,
    ],
  ]);

  return yargs as Argv<ProjectAddArgs>;
}

const builder = makeYargsBuilder<ProjectAddArgs>(
  projectAddBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const projectAddCommand: YargsCommandModule<unknown, ProjectAddArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectAddCommand;
