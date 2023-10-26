const { logger } = require('@hubspot/cli-lib/logger');
const { updateHttpTimeout } = require('@hubspot/local-dev-lib/config');
const { promptUser } = require('../../../lib/prompts/promptUtils');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { i18n } = require('../../../lib/lang');

const i18nKey = 'cli.commands.config.subcommands.set.options.httpTimeout';

const enterTimeout = async () => {
  const { timeout } = await promptUser([
    {
      name: 'timeout',
      message: i18n(`${i18nKey}.promptMessage`),
      type: 'input',
      default: 30000,
    },
  ]);

  return timeout;
};

const setHttpTimeout = async ({ accountId, httpTimeout }) => {
  trackCommandUsage('config-set-http-timeout', null, accountId);

  let newHttpTimeout;

  if (!httpTimeout) {
    newHttpTimeout = await enterTimeout();
  } else {
    newHttpTimeout = httpTimeout;
  }

  updateHttpTimeout(newHttpTimeout);

  return logger.success(
    i18n(`${i18nKey}.success`, { timeout: newHttpTimeout })
  );
};

module.exports = {
  setHttpTimeout,
};
