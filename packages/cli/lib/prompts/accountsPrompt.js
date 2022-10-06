const { updateDefaultAccount } = require('@hubspot/cli-lib/lib/config');
const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.use';

const selectAccountFromConfig = async config => {
  const { default: selectedDefault } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: config.portals.map(p => ({
        name: `${p.name} (${p.portalId})`,
        value: p.name || p.portalId,
      })),
      default: config.defaultPortal,
    },
  ]);

  return selectedDefault;
};

const selectAndSetAsDefaultAccountPrompt = async config => {
  const { default: selectedDefault } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessageReplaceDefault`),
      choices: config.portals.map(p => ({
        name: `${p.name} (${p.portalId})`,
        value: p.name || p.portalId,
      })),
      default: config.defaultPortal,
    },
  ]);
  updateDefaultAccount(selectedDefault);
};

module.exports = {
  selectAndSetAsDefaultAccountPrompt,
  selectAccountFromConfig,
};
