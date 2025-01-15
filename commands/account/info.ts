import { Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { getTableContents } from '../../lib/ui/table';
import { CommonOptions } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.info';
const describe = i18n(`${i18nKey}.describe`);

const command = 'info [account]';

async function handler(options: CommonOptions): Promise<void> {
  const { derivedAccountId } = options;
  const config = getAccountConfig(derivedAccountId);
  // check if the provided account is using a personal access key, if not, show an error
  if (config && config.authType === 'personalaccesskey') {
    const { name, personalAccessKey, env } = config;
    let scopeGroups: string[][] = [];

    if (personalAccessKey) {
      const response = await getAccessToken(
        personalAccessKey,
        env,
        derivedAccountId
      );

      scopeGroups = response.scopeGroups.map(s => [s]);
    }

    if (name) {
      logger.log(i18n(`${i18nKey}.name`, { name }));
    }
    logger.log(i18n(`${i18nKey}.accountId`, { accountId: derivedAccountId }));
    logger.log(i18n(`${i18nKey}.scopeGroups`));
    logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
  } else {
    logger.log(i18n(`${i18nKey}.errors.notUsingPersonalAccessKey`));
  }
}

function builder(yargs: Argv): Argv {
  addConfigOptions(yargs);

  yargs.example([
    ['$0 accounts info', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts info MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
    ['$0 accounts info 1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs;
}

const yargsCommand = {
  describe,
  command,
  handler,
  builder,
};

export default yargsCommand;
module.exports = yargsCommand;
