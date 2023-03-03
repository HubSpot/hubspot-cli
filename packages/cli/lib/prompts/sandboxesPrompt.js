const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { mapAccountChoices } = require('./accountsPrompt');

const i18nKey = 'cli.lib.prompts.sandboxesPrompt';

const getSandboxType = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

const mapSandboxAccountChoices = portals =>
  portals
    .filter(p => p.sandboxAccountType && p.sandboxAccountType !== null)
    .map(p => {
      const sandboxName = `[${getSandboxType(p.sandboxAccountType)} sandbox] `;
      return {
        name: `${p.name} ${sandboxName}(${p.portalId})`,
        value: p.name || p.portalId,
      };
    });

const createSandboxPrompt = () => {
  return promptUser([
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidName`);
        }
        return true;
      },
      default: 'New sandbox',
    },
  ]);
};

const deleteSandboxPrompt = (config, promptParentAccount = false) => {
  return promptUser([
    {
      name: 'account',
      message: i18n(
        promptParentAccount
          ? `${i18nKey}.selectParentAccountName`
          : `${i18nKey}.selectAccountName`
      ),
      type: 'list',
      look: false,
      pageSize: 20,
      choices: promptParentAccount
        ? mapAccountChoices(config.portals)
        : mapSandboxAccountChoices(config.portals),
      default: config.defaultPortal,
    },
  ]);
};

module.exports = {
  createSandboxPrompt,
  deleteSandboxPrompt,
  getSandboxType,
};
