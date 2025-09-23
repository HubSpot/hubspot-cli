import { ArgumentsCamelCase, Argv } from 'yargs';
import path from 'path';
import fs from 'fs';
import {
  trackCommandUsage,
  trackCommandMetadataUsage,
} from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { selectPublicAppForMigrationPrompt } from '../../lib/prompts/selectPublicAppForMigrationPrompt.js';
import { projectNameAndDestPrompt } from '../../lib/prompts/projectNameAndDestPrompt.js';
import { poll } from '../../lib/polling.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  isAppDeveloperAccount,
  isUnifiedAccount,
} from '../../lib/accountTypes.js';
import { writeProjectConfig } from '../../lib/projects/config.js';
import { PROJECT_CONFIG_FILE } from '../../lib/constants.js';
import {
  cloneApp,
  checkCloneStatus,
  downloadClonedProject,
} from '@hubspot/local-dev-lib/api/projects';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { uiLogger } from '../../lib/ui/logger.js';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import SpinniesManager from '../../lib/ui/SpinniesManager.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { logInvalidAccountError } from '../../lib/app/migrate.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import {
  uiDeprecatedTag,
  uiLine,
  uiAccountDescription,
} from '../../lib/ui/index.js';

const command = 'clone-app';
const describe = uiDeprecatedTag(commands.project.cloneApp.describe, false);
const deprecated = true;

type CloneAppArgs = ConfigArgs &
  EnvironmentArgs &
  AccountArgs &
  CommonArgs & {
    dest: string;
    appId: number;
  };

async function handler(args: ArgumentsCamelCase<CloneAppArgs>): Promise<void> {
  const { derivedAccountId } = args;
  await trackCommandUsage('clone-app', {}, derivedAccountId);

  const accountConfig = getAccountConfig(derivedAccountId);
  const accountName = uiAccountDescription(derivedAccountId);

  if (!accountConfig) {
    throw new Error(
      commands.project.cloneApp.errors.noAccountConfig(derivedAccountId)
    );
  }

  const defaultAccountIsUnified = await isUnifiedAccount(accountConfig);

  if (!isAppDeveloperAccount(accountConfig) && !defaultAccountIsUnified) {
    logInvalidAccountError();
    process.exit(EXIT_CODES.SUCCESS);
  }

  let appId;
  let projectName;
  let projectDest;
  try {
    appId = args.appId;
    if (!appId) {
      const appIdResponse = await selectPublicAppForMigrationPrompt({
        accountId: derivedAccountId,
        accountName,
        isMigratingApp: false,
      });
      appId = appIdResponse.appId;
    }

    const projectNameAndDestPromptResponse =
      await projectNameAndDestPrompt(args);

    projectName = projectNameAndDestPromptResponse.name;
    projectDest = projectNameAndDestPromptResponse.dest;
  } catch (error) {
    logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    process.exit(EXIT_CODES.ERROR);
  }

  await trackCommandMetadataUsage(
    'clone-app',
    { step: 'STARTED' },
    derivedAccountId
  );

  try {
    SpinniesManager.init();

    SpinniesManager.add('cloneApp', {
      text: commands.project.cloneApp.cloneStatus.inProgress,
    });

    const {
      data: { exportId },
    } = await cloneApp(derivedAccountId, appId);
    const { status } = await poll(() =>
      checkCloneStatus(derivedAccountId, exportId)
    );
    if (status === 'SUCCESS') {
      // Ensure correct project folder structure exists
      const baseDestPath = path.resolve(getCwd(), projectDest);
      const absoluteDestPath = path.resolve(baseDestPath, 'src', 'app');
      fs.mkdirSync(absoluteDestPath, { recursive: true });

      // Extract zipped app files and place them in correct directory
      const { data: zippedApp } = await downloadClonedProject(
        derivedAccountId,
        exportId
      );
      await extractZipArchive(
        zippedApp,
        sanitizeFileName(projectName),
        absoluteDestPath,
        {
          includesRootDir: true,
          hideLogs: true,
        }
      );

      // Create hsproject.json file
      const configPath = path.join(baseDestPath, PROJECT_CONFIG_FILE);
      const configContent = {
        name: projectName,
        srcDir: 'src',
        platformVersion: '2023.2',
      };
      const success = writeProjectConfig(configPath, configContent);

      SpinniesManager.succeed('cloneApp', {
        text: commands.project.cloneApp.cloneStatus.done,
        succeedColor: 'white',
      });
      if (!success) {
        uiLogger.error(
          commands.project.cloneApp.errors.couldNotWriteConfigPath(configPath)
        );
      }
      uiLogger.log('');
      uiLine();
      uiLogger.success(
        commands.project.cloneApp.cloneStatus.success(projectDest)
      );
      uiLogger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    await trackCommandMetadataUsage(
      'clone-app',
      { successful: false },
      derivedAccountId
    );

    SpinniesManager.fail('cloneApp', {
      text: commands.project.cloneApp.cloneStatus.failure,
      failColor: 'white',
    });

    // Migrations endpoints return a response object with an errors property. The errors property contains an array of errors.
    if (
      error &&
      typeof error === 'object' &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      error.errors.forEach(e =>
        logError(e, new ApiErrorContext({ accountId: derivedAccountId }))
      );
    } else {
      logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    }
  }

  await trackCommandMetadataUsage(
    'clone-app',
    { successful: true },
    derivedAccountId
  );
  process.exit(EXIT_CODES.SUCCESS);
}

function cloneAppBuilder(yargs: Argv): Argv<CloneAppArgs> {
  yargs.options({
    dest: {
      describe: commands.project.cloneApp.options.dest.describe,
      type: 'string',
    },
    'app-id': {
      describe: commands.project.cloneApp.options.appId.describe,
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project clone-app', commands.project.cloneApp.examples.default],
  ]);

  return yargs as Argv<CloneAppArgs>;
}

const builder = makeYargsBuilder<CloneAppArgs>(
  cloneAppBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const cloneAppCommand: YargsCommandModule<unknown, CloneAppArgs> = {
  command,
  describe,
  handler,
  builder,
  deprecated,
};

export default cloneAppCommand;
