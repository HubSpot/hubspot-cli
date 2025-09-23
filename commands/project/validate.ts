import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';

import { getAccountConfig } from '@hubspot/local-dev-lib/config';

import { isV2Project } from '../../lib/projects/platformVersion.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import {
  validateSourceDirectory,
  handleTranslate,
} from '../../lib/projects/upload.js';

import { commands } from '../../lang/en.js';
import { loadAndValidateProfile } from '../../lib/projectProfiles.js';
import { logError } from '../../lib/errorHandlers/index.js';

const command = 'validate';
const describe = commands.project.validate.describe;

type ProjectValidateArgs = CommonArgs & {
  profile?: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectValidateArgs>
): Promise<void> {
  const { derivedAccountId, profile } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.validate.mustBeRanWithinAProject);
    process.exit(EXIT_CODES.ERROR);
  }

  if (!isV2Project(projectConfig?.platformVersion)) {
    uiLogger.error(commands.project.validate.badVersion);
    process.exit(EXIT_CODES.ERROR);
  }

  validateProjectConfig(projectConfig, projectDir);

  let targetAccountId = await loadAndValidateProfile(
    projectConfig,
    projectDir,
    profile
  );

  targetAccountId = targetAccountId || derivedAccountId;

  const accountConfig = getAccountConfig(targetAccountId!);
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage(
    'project-validate',
    { type: accountType! },
    targetAccountId
  );

  const srcDir = path.resolve(projectDir!, projectConfig.srcDir);

  try {
    await validateSourceDirectory(srcDir, projectConfig, projectDir);
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await handleTranslate(
      projectDir!,
      projectConfig,
      targetAccountId,
      false,
      profile
    );
  } catch (e) {
    logError(e);
    uiLogger.error(commands.project.validate.failure(projectConfig.name));
    process.exit(EXIT_CODES.ERROR);
  }

  uiLogger.success(commands.project.validate.success(projectConfig.name));
  process.exit(EXIT_CODES.SUCCESS);
}

function projectValidateBuilder(yargs: Argv): Argv<ProjectValidateArgs> {
  yargs.options({
    profile: {
      type: 'string',
      alias: 'p',
      describe: commands.project.validate.options.profile.describe,
      hidden: true,
    },
  });

  yargs.conflicts('profile', 'account');

  yargs.example([
    ['$0 project validate', commands.project.validate.examples.default],
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
  }
);

const projectValidateCommand: YargsCommandModule<unknown, ProjectValidateArgs> =
  {
    command,
    describe,
    handler,
    builder,
  };

export default projectValidateCommand;
