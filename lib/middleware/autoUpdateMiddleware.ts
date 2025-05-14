// Update-notifier is CommonJS, so we need to use require
const updateNotifier = require('update-notifier');

import { isConfigFlagEnabled } from '@hubspot/local-dev-lib/config';
import pkg from '../../package.json';
import { UI_COLORS } from '../ui';
import SpinniesManager from '../ui/SpinniesManager';
import { lib } from '../../lang/en';
import { isGloballyInstalled, executeInstall } from '../npm';
import { debugError } from '../errorHandlers';
import { uiLogger } from '../ui/logger';

// Default behavior is to check for notifications at most once per day
// update-notifier stores the last checked date in the user's home directory
const notifier = updateNotifier({
  pkg: { ...pkg, name: '@hubspot/cli' },
  distTag: 'latest',
  shouldNotifyInNpmScript: true,
});

const CMS_CLI_PACKAGE_NAME = '@hubspot/cms-cli';

function updateNotification(): void {
  notifier.notify({
    message:
      pkg.name === CMS_CLI_PACKAGE_NAME
        ? lib.middleware.updateNotification.cmsUpdateNotification(
            CMS_CLI_PACKAGE_NAME
          )
        : lib.middleware.updateNotification.cliUpdateNotification,
    defer: false,
    boxenOptions: {
      borderColor: UI_COLORS.MARIGOLD_DARK,
      margin: 1,
      padding: 1,
      textAlignment: 'center',
      borderStyle: 'round',
      title:
        pkg.name === CMS_CLI_PACKAGE_NAME
          ? null
          : lib.middleware.updateNotification.notifyTitle,
    },
  });
}

export async function autoUpdateCLI() {
  // This lets us back to default update-notifier behavior
  let showManualInstallHelp = true;

  if (
    notifier &&
    notifier.update &&
    !process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES &&
    isConfigFlagEnabled('allowAutoUpdates')
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
          if (await isGloballyInstalled()) {
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

  if (showManualInstallHelp) {
    updateNotification();
  }
}
