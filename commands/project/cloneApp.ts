import { uiDeprecatedTag } from '../../lib/ui';
import path from 'path';
import fs from 'fs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import {
  trackCommandUsage,
  trackCommandMetadataUsage,
} from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { selectPublicAppPrompt } from '../../lib/prompts/selectPublicAppPrompt';
import { createProjectPrompt } from '../../lib/prompts/createProjectPrompt';
import { poll } from '../../lib/polling';
import { uiLine, uiAccountDescription } from '../../lib/ui';
import { logError, ApiErrorContext } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  isAppDeveloperAccount,
  isUnifiedAccount,
} from '../../lib/accountTypes';
import { writeProjectConfig } from '../../lib/projects';
import { PROJECT_CONFIG_FILE } from '../../lib/constants';
import {
  cloneApp,
  checkCloneStatus,
  downloadClonedProject,
} from '@hubspot/local-dev-lib/api/projects';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs';
import { logInvalidAccountError } from '../../lib/app/migrate';

const i18nKey = 'commands.project.subcommands.cloneApp';

export const command = 'clone-app';
export const describe = uiDeprecatedTag(i18n(`${i18nKey}.describe`), false);
export const deprecated = true;

export type CloneAppArgs = ConfigArgs &
  EnvironmentArgs &
  AccountArgs &
  CommonArgs & {
    dest: string;
    appId: number;
  };

export const handler = async (options: ArgumentsCamelCase<CloneAppArgs>) => {
  const { derivedAccountId } = options;
  await trackCommandUsage('clone-app', {}, derivedAccountId);

  const accountConfig = getAccountConfig(derivedAccountId);
  const accountName = uiAccountDescription(derivedAccountId);

  if (!accountConfig) {
    throw new Error(
      i18n(`commands.projects.subcommands.cloneApp.errors.noAccountConfig`)
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
    appId = options.appId;
    if (!appId) {
      const appIdResponse = await selectPublicAppPrompt({
        accountId: derivedAccountId,
        accountName,
        isMigratingApp: false,
      });
      appId = appIdResponse.appId;
    }
    const createProjectPromptResponse = await createProjectPrompt(options);

    projectName = createProjectPromptResponse.name;
    projectDest = createProjectPromptResponse.dest;
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
      text: i18n(`${i18nKey}.cloneStatus.inProgress`),
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
        text: i18n(`${i18nKey}.cloneStatus.done`),
        succeedColor: 'white',
      });
      if (!success) {
        logger.error(
          i18n(`${i18nKey}.errors.couldNotWriteConfigPath`),
          configPath
        );
      }
      logger.log('');
      uiLine();
      logger.success(
        i18n(`${i18nKey}.cloneStatus.success`, { dest: projectDest })
      );
      logger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    await trackCommandMetadataUsage(
      'clone-app',
      { successful: false },
      derivedAccountId
    );

    SpinniesManager.fail('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.failure`),
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
};

export const builder = (yargs: Argv) => {
  yargs.options({
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    'app-id': {
      describe: i18n(`${i18nKey}.options.appId.describe`),
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project clone-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs as Argv<CloneAppArgs>;
};

const cloneAppCommand: CommandModule<unknown, CloneAppArgs> = {
  command,
  describe,
  handler,
  builder,
  deprecated,
};

export default cloneAppCommand;
