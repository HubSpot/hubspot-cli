import { Arguments } from 'yargs';
import updateNotifier from 'update-notifier';
import { getConfig } from '@hubspot/local-dev-lib/config';
import { pkg } from '../jsonLoader.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { lib } from '../../lang/en.js';
import {
  DEFAULT_PACKAGE_MANAGER,
  isGloballyInstalled,
  executeInstall,
} from '../npm.js';
import { debugError } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import { isTargetedCommand } from './commandTargetingUtils.js';
import { renderInline } from '../../ui/index.js';
import { getWarningBox } from '../../ui/components/StatusMessageBoxes.js';

// Default behavior is to check for notifications at most once per day
// update-notifier stores the last checked date in the user's home directory
const notifier = updateNotifier({
  pkg: { ...pkg, name: '@hubspot/cli' },
  distTag: 'latest',
  shouldNotifyInNpmScript: true,
});

const CMS_CLI_PACKAGE_NAME = '@hubspot/cms-cli';

async function updateNotification(
  currentVersion: string,
  latestVersion: string,
  updateCommand: string
): Promise<void> {
  await renderInline(
    getWarningBox({
      title:
        pkg.name === CMS_CLI_PACKAGE_NAME
          ? ''
          : lib.middleware.updateNotification.notifyTitle,
      message:
        pkg.name === CMS_CLI_PACKAGE_NAME
          ? lib.middleware.updateNotification.cmsUpdateNotification(
              CMS_CLI_PACKAGE_NAME
            )
          : lib.middleware.updateNotification.cliUpdateNotification(
              currentVersion,
              updateCommand,
              latestVersion
            ),
      textCentered: true,
    })
  );
}

const SKIP_AUTO_UPDATE_COMMANDS = {
  config: {
    set: true,
  },
};

const preventAutoUpdateForCommand = (commandParts: (string | number)[]) => {
  return isTargetedCommand(commandParts, SKIP_AUTO_UPDATE_COMMANDS);
};

export async function autoUpdateCLI(argv: Arguments<{ useEnv?: boolean }>) {
  let showManualInstallHelp = true;

  let isGlobalInstall: boolean | null = null;
  const checkGlobalInstall = async () => {
    if (isGlobalInstall === null) {
      isGlobalInstall =
        (await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER)) &&
        (await isGloballyInstalled('hs'));
    }
    return isGlobalInstall;
  };

  let config;

  try {
    config = getConfig();
  } catch (e) {
    debugError(e);
  }

  if (
    notifier &&
    notifier.update &&
    !argv.useEnv &&
    !process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES &&
    config?.allowAutoUpdates === true &&
    !preventAutoUpdateForCommand(argv._)
  ) {
    // Ignore all update notifications if the current version is a pre-release
    if (!notifier.update.current.includes('-')) {
      // Attempt auto-update if the current version is not the latest version
      // Never auto-update for major version updates b/c they are breaking
      if (!['major', 'latest'].includes(notifier.update.type)) {
        SpinniesManager.init({
          succeedColor: 'white',
        });
        SpinniesManager.add('cliAutoUpdate', {
          text: lib.middleware.autoUpdateCLI.updateAvailable(
            notifier.update.latest
          ),
        });

        try {
          if (await checkGlobalInstall()) {
            await executeInstall(['@hubspot/cli@latest'], '-g');
            showManualInstallHelp = false;

            SpinniesManager.succeed('cliAutoUpdate', {
              text: lib.middleware.autoUpdateCLI.updateSucceeded(
                notifier.update.latest
              ),
            });
            uiLogger.log('');
          } else {
            SpinniesManager.fail('cliAutoUpdate', {
              text: lib.middleware.autoUpdateCLI.notInstalledGlobally,
            });
          }
        } catch (e) {
          debugError(e);
          SpinniesManager.fail('cliAutoUpdate', {
            text: lib.middleware.autoUpdateCLI.updateFailed(
              notifier.update.latest
            ),
          });
        }
      }
    }
  }

  if (
    showManualInstallHelp &&
    notifier.update &&
    process.stdout.isTTY &&
    !notifier.update.current.includes('-')
  ) {
    await updateNotification(
      notifier.update.current,
      notifier.update.latest,
      `npm i ${(await checkGlobalInstall()) ? '-g' : ''} @hubspot/cli`
    );
  }
}
