import { Argv, ArgumentsCamelCase } from 'yargs';

import { logError } from '../../lib/errorHandlers/index.js';
import { getIsInProject, getProjectConfig } from '../../lib/projects/config.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { isPromptExitError } from '../../lib/errors/PromptExitError.js';
import {
  YargsCommandModule,
  CommonArgs,
  ConfigArgs,
  JSONOutputArgs,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import {
  ProjectAddJsonOutput,
  ProjectAddSchema,
} from '../../lib/jsonOutput/projectAdd.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
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
  ConfigArgs &
  JSONOutputArgs<ProjectAddJsonOutput> & {
    type?: string;
    name?: string;
    features?: string[];
    distribution?: string;
    auth?: string;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectAddArgs>
): Promise<void> {
  const { derivedAccountId, exit, addJsonOutput } = args;

  const isInProjectDir = getIsInProject();

  if (!isInProjectDir) {
    uiLogger.error(commands.project.add.error.locationInProject);
    return exit(EXIT_CODES.ERROR);
  }

  try {
    const { projectConfig, projectDir } = getProjectConfig();

    const isLegacyProjectCreate = isLegacyProject(
      projectConfig.platformVersion
    );

    const result: ProjectAddJsonOutput = isLegacyProjectCreate
      ? await legacyAddComponent(
          args,
          projectDir,
          projectConfig,
          derivedAccountId
        )
      : await v2AddComponent(args, projectDir, projectConfig, derivedAccountId);

    addJsonOutput(result);
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }
  return exit(EXIT_CODES.SUCCESS);
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
    useJSONOutputOptions: true,
  }
);

const projectAddCommand: YargsCommandModule<unknown, ProjectAddArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('project-add', handler, {
    jsonOutputSchema: ProjectAddSchema,
  }),
  builder,
};

export default projectAddCommand;
