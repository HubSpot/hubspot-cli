const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.whoami';
exports.describe = i18n(`${i18nKey}.describe`);

exports.command = 'whoami';

exports.handler = () => {
  logger.log('TESTING');
};
