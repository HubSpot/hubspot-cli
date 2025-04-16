// Update-notifier is CommonJS, so we need to use require
const updateNotifier = require('update-notifier');
const chalk = require('chalk');
const pkg = require('../../package.json');
const { UI_COLORS, uiCommandReference } = require('../ui');
const { i18n } = require('../lang');

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
        ? i18n(`commands.generalErrors.updateNotify.cmsUpdateNotification`, {
            packageName: CMS_CLI_PACKAGE_NAME,
            updateCommand: uiCommandReference('{updateCommand}'),
          })
        : i18n(`commands.generalErrors.updateNotify.cliUpdateNotification`, {
            updateCommand: uiCommandReference('{updateCommand}'),
          }),
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
          : chalk.bold(i18n(`commands.generalErrors.updateNotify.notifyTitle`)),
    },
  });
}
