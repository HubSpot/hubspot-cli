import { Arguments } from 'yargs';
import { isConfigFlagEnabled } from '@hubspot/local-dev-lib/config';
import { CONFIG_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { pkg } from '../jsonLoader.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { lib } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import { isTargetedCommand } from './commandTargetingUtils.js';
import { renderInline } from '../../ui/render.js';
import { getWarningBox } from '../../ui/components/StatusMessageBoxes.js';
import {
  getCliUpgradeInfo,
  installCliVersion,
  isCliGloballyInstalled,
  canCliBeAutoUpgraded,
} from '../cliUpgradeUtils.js';

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
  upgrade: true,
  update: true,
  config: {
    set: true,
  },
};

const preventAutoUpdateForCommand = (commandParts: (string | number)[]) => {
  return isTargetedCommand(commandParts, SKIP_AUTO_UPDATE_COMMANDS);
};

export async function autoUpdateCLI(argv: Arguments<{ useEnv?: boolean }>) {
  let showManualInstallHelp = true;
  let isAllowAutoUpdatesEnabled = false;

  try {
    // Default to false if the flag is not set. Users must explicitly enable auto-updates.
    isAllowAutoUpdatesEnabled = isConfigFlagEnabled(
      CONFIG_FLAGS.ALLOW_AUTO_UPDATES,
      false
    );
  } catch (e) {
    debugError(e);
  }

  const cliUpgradeInfo = getCliUpgradeInfo();

  // Ignore all update notifications if the current version is a pre-release (contains a hyphen)
  if (cliUpgradeInfo.current && cliUpgradeInfo.current.includes('-')) {
    showManualInstallHelp = false;
  }

  if (
    isAllowAutoUpdatesEnabled &&
    cliUpgradeInfo.current &&
    cliUpgradeInfo.latest &&
    cliUpgradeInfo.type &&
    !argv.useEnv &&
    !process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES &&
    !preventAutoUpdateForCommand(argv._)
  ) {
    if (!showManualInstallHelp) {
      // Pre-release version detected, skip auto-update
    } else if (!['major', 'latest'].includes(cliUpgradeInfo.type)) {
      // type "latest" => current installed version is latest
      // Auto-update if upgrade type is "minor" or "patch"
      SpinniesManager.init({
        succeedColor: 'white',
      });
      SpinniesManager.add('cliAutoUpdate', {
        text: lib.middleware.autoUpdateCLI.updateAvailable(
          cliUpgradeInfo.latest
        ),
      });
      try {
        if (await canCliBeAutoUpgraded()) {
          await installCliVersion();
          showManualInstallHelp = false;

          SpinniesManager.succeed('cliAutoUpdate', {
            text: lib.middleware.autoUpdateCLI.updateSucceeded(
              cliUpgradeInfo.latest
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
            cliUpgradeInfo.latest
          ),
        });
      }
    }
  }

  // Fallback to showing the manual install message if we cannot auto-upgrade
  if (
    showManualInstallHelp &&
    cliUpgradeInfo.latest &&
    cliUpgradeInfo.current &&
    cliUpgradeInfo.type !== 'latest' &&
    cliUpgradeInfo.current !== cliUpgradeInfo.latest &&
    process.stdout.isTTY
  ) {
    await updateNotification(
      cliUpgradeInfo.current,
      cliUpgradeInfo.latest,
      `npm i ${(await isCliGloballyInstalled()) ? '-g' : ''} ${pkg.name}`
    );

    // Let users know that auto-updates can be enabled by setting the allow-auto-updates config flag
    if (
      !isAllowAutoUpdatesEnabled &&
      (await canCliBeAutoUpgraded()) &&
      cliUpgradeInfo.type !== 'major'
    ) {
      uiLogger.log('');
      uiLogger.log(lib.middleware.autoUpdateCLI.enableAutoUpdatesMessage);
      uiLogger.log('');
    }
  }
}
