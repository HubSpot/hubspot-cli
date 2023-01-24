const { updateDefaultAccount } = require('@hubspot/cli-lib/lib/config');
const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const getSandboxType = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

const mapAccountChoices = portals =>
  portals.map(p => {
    const isSandbox = p.sandboxAccountType && p.sandboxAccountType !== null;
    const sandboxName = `[${getSandboxType(p.sandboxAccountType)} sandbox] `;
    return {
      name: `${p.name} ${isSandbox ? sandboxName : ''}(${p.portalId})`,
      value: p.name || p.portalId,
    };
  });

const i18nKey = 'cli.commands.accounts.subcommands.use';

const selectAccountFromConfig = async config => {
  const { default: selectedDefault } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: mapAccountChoices(config.portals),
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
      message: i18n(`${i18nKey}.promptMessage`),
      choices: mapAccountChoices(config.portals),
      default: config.defaultPortal,
    },
  ]);
  updateDefaultAccount(selectedDefault);
};

module.exports = {
  selectAndSetAsDefaultAccountPrompt,
  selectAccountFromConfig,
};
