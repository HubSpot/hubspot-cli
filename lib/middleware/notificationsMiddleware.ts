import updateNotifier from 'update-notifier';
import pkg from '../../package.json' with { type: 'json' };
import { UI_COLORS } from '../ui/index.js';
import { lib } from '../../lang/en.js';

const notifier = updateNotifier({
  pkg: { ...pkg, name: '@hubspot/cli' },
  distTag: 'latest',
  shouldNotifyInNpmScript: true,
});

const CMS_CLI_PACKAGE_NAME = '@hubspot/cms-cli';

export function notifyAboutUpdates(): void {
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
          ? undefined
          : lib.middleware.updateNotification.notifyTitle,
    },
  });
}
