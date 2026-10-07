import { Argv, ArgumentsCamelCase } from 'yargs';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { uiLogger } from '../../lib/ui/logger.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { logError } from '../../lib/errorHandlers/index.js';
import {
  validateProject,
  toIssue,
  ProjectValidationResult,
} from '../../lib/projects/validate.js';
import { ProjectConfig } from '../../types/Projects.js';
import {
  ProjectValidateJsonOutput,
  ProjectValidateSchema,
} from '../../lib/jsonOutput/projectValidate.js';

const command = 'validate';
const describe = commands.project.validate.describe;

export type ProjectValidateArgs = CommonArgs &
  JSONOutputArgs<ProjectValidateJsonOutput> & {
    profile?: string;
  };

type GenerateJsonArgs = {
  result: ProjectValidationResult;
  projectConfig?: ProjectConfig;
  profile?: string;
};

function generateJson({
  result,
  projectConfig,
  profile,
}: GenerateJsonArgs): ProjectValidateJsonOutput {
  const { valid, errors, warnings, profiles } = result;
  const output: ProjectValidateJsonOutput = { valid, errors, warnings };
  if (projectConfig) {
    output.projectName = projectConfig.name;
    output.platformVersion = projectConfig.platformVersion;
  }
  if (profile) {
    output.profile = profile;
  }
  if (profiles.length > 0) {
    output.profiles = profiles;
  }
  return output;
}

async function handler(
  args: ArgumentsCamelCase<ProjectValidateArgs>
): Promise<void> {
  const {
    derivedAccountId,
    profile,
    exit,
    addUsageMetadata,
    formatOutputAsJson,
    addJsonOutput,
  } = args;

  let projectConfig: ProjectConfig | undefined;
  let projectDir: string | undefined;

  function outputError(error: unknown): void {
    logError(error);
    addJsonOutput(
      generateJson({
        result: {
          valid: false,
          errors: [toIssue(error)],
          warnings: [],
          profiles: [],
        },
        projectConfig,
        profile,
      })
    );
  }

  try {
    const accountConfig = getConfigAccountById(derivedAccountId!);
    const accountType = accountConfig && accountConfig.accountType;
    addUsageMetadata({ type: accountType! });

    ({ projectConfig, projectDir } = getProjectConfig());
  } catch (error) {
    outputError(error);
    return exit(EXIT_CODES.ERROR);
  }

  if (isLegacyProject(projectConfig.platformVersion)) {
    const message = commands.project.validate.badVersion;
    uiLogger.error(message);
    addJsonOutput(
      generateJson({
        result: {
          valid: false,
          errors: [{ message }],
          warnings: [],
          profiles: [],
        },
        projectConfig,
        profile,
      })
    );
    return exit(EXIT_CODES.ERROR);
  }

  let result: ProjectValidationResult;
  try {
    result = await validateProject({
      projectConfig,
      projectDir,
      derivedAccountId,
      profile,
      formatOutputAsJson,
    });
  } catch (error) {
    outputError(error);
    return exit(EXIT_CODES.ERROR);
  }

  addJsonOutput(generateJson({ result, projectConfig, profile }));

  if (!result.valid) {
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.success(commands.project.validate.success(projectConfig.name));
  return exit(EXIT_CODES.SUCCESS);
}

function projectValidateBuilder(yargs: Argv): Argv<ProjectValidateArgs> {
  yargs.options({
    profile: {
      type: 'string',
      alias: 'p',
      describe: commands.project.validate.options.profile.describe,
    },
  });

  yargs.conflicts('profile', 'account');

  yargs.example([
    ['$0 project validate', commands.project.validate.examples.default],
    [
      '$0 project validate --profile=profileName',
      commands.project.validate.examples.withProfile,
    ],
    ['$0 project validate --json', commands.project.validate.examples.json],
  ]);
  return yargs as Argv<ProjectValidateArgs>;
}

const builder = makeYargsBuilder<ProjectValidateArgs>(
  projectValidateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useJSONOutputOptions: true,
  }
);

const projectValidateCommand: YargsCommandModule<unknown, ProjectValidateArgs> =
  {
    command,
    describe,
    handler: makeWrappedYargsHandler('project-validate', handler, {
      jsonOutputSchema: ProjectValidateSchema,
    }),
    builder,
  };

export default projectValidateCommand;
