import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';

import { getConfigAccountById } from '@hubspot/local-dev-lib/config';

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
import { validateProjectForProfile } from '../../lib/projects/projectProfiles.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import SpinniesManager from '../../lib/ui/SpinniesManager.js';

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

  const accountConfig = getConfigAccountById(derivedAccountId!);
  const accountType = accountConfig && accountConfig.accountType;
  trackCommandUsage(
    'project-validate',
    { type: accountType! },
    derivedAccountId
  );

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.validate.mustBeRanWithinAProject);
    process.exit(EXIT_CODES.ERROR);
  }

  if (!isV2Project(projectConfig?.platformVersion)) {
    uiLogger.error(commands.project.validate.badVersion);
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

  let validationSucceeded = true;
  const srcDir = path.resolve(projectDir!, projectConfig.srcDir);

  const profiles = await getAllHsProfiles(
    path.join(projectDir, projectConfig.srcDir)
  );

  // If a profile is specified, only validate that profile
  if (profile) {
    const validationErrors = await validateProjectForProfile({
      projectConfig,
      projectDir,
      profileName: profile,
      derivedAccountId,
    });
    if (validationErrors.length) {
      logValidationErrors(validationErrors);
      validationSucceeded = false;
    }
  } else if (profiles.length > 0) {
    // If no profile was specified and the project has profiles, validate all of them
    SpinniesManager.add('validatingAllProfiles', {
      text: commands.project.validate.spinners.validatingAllProfiles,
    });
    const errors: (string | Error)[] = [];

    for (const profileName of profiles) {
      const validationErrors = await validateProjectForProfile({
        projectConfig,
        projectDir,
        profileName,
        derivedAccountId,
        indentSpinners: true,
      });
      if (validationErrors.length) {
        errors.push(...validationErrors);
        validationSucceeded = false;
      }
    }

    if (validationSucceeded) {
      SpinniesManager.succeed('validatingAllProfiles', {
        text: commands.project.validate.spinners.allProfilesValidationSucceeded,
      });
    } else {
      SpinniesManager.fail('validatingAllProfiles', {
        text: commands.project.validate.spinners.allProfilesValidationFailed,
      });
    }

    logValidationErrors(errors);
  } else if (profiles.length === 0) {
    // If the project has no profiles, validate the project without a profile
    try {
      await handleTranslate({
        projectDir: projectDir!,
        projectConfig,
        accountId: derivedAccountId,
        skipValidation: false,
      });
    } catch (e) {
      uiLogger.error(commands.project.validate.failure(projectConfig.name));
      logError(e);
      validationSucceeded = false;
      uiLogger.log('');
    }
  }

  if (!validationSucceeded) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await validateSourceDirectory(srcDir, projectConfig, projectDir);
  } catch (e) {
    logError(e);
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
    },
  });

  yargs.conflicts('profile', 'account');

  yargs.example([
    ['$0 project validate', commands.project.validate.examples.default],
    [
      '$0 project validate --profile=profileName',
      commands.project.validate.examples.withProfile,
    ],
  ]);
  return yargs as Argv<ProjectValidateArgs>;
}

function logValidationErrors(validationErrors: (string | Error)[]) {
  uiLogger.log('');
  validationErrors.forEach(error => {
    if (error instanceof Error) {
      logError(error);
    } else {
      uiLogger.log(error);
    }
  });
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
