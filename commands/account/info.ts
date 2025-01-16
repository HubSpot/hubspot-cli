import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { Arguments, CommandModule, Argv } from 'yargs';

import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { getTableContents } from '../../lib/ui/table';
import {
  CommonOptions,
  ConfigOptions,
  BooleanOptionsType,
} from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.info';

type InfoOptions = CommonOptions & ConfigOptions & CustomOptions;

type CustomOptions = {
  testOption?: boolean;
};

class Info implements CommandModule<CommonOptions, InfoOptions> {
  public command = 'info [account]';
  public describe = i18n(`${i18nKey}.describe`);

  public async handler(options: Arguments<InfoOptions>): Promise<void> {
    const { derivedAccountId, testOption, config: configOption } = options;

    console.log(testOption, configOption);

    const config = getAccountConfig(derivedAccountId);

    // check if the provided account is using a personal access key, if not, show an error
    if (config?.authType === 'personalaccesskey' && config.personalAccessKey) {
      const { name, personalAccessKey, env } = config;

      const response = await getAccessToken(
        personalAccessKey,
        env,
        derivedAccountId
      );

      const scopeGroups = response.scopeGroups.map(s => [s]);

      logger.log(i18n(`${i18nKey}.name`, { name: name || '' }));
      logger.log(i18n(`${i18nKey}.accountId`, { accountId: derivedAccountId }));
      logger.log(i18n(`${i18nKey}.scopeGroups`));
      logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
    } else {
      logger.log(i18n(`${i18nKey}.errors.notUsingPersonalAccessKey`));
    }
  }

  public builder(yargs: Argv<CommonOptions>): Argv<InfoOptions> {
    const withConfigOptions = addConfigOptions<CommonOptions>(yargs);
    const withCustomOptions = withConfigOptions.option<
      keyof CustomOptions,
      BooleanOptionsType
    >('testOption', { type: 'boolean', describe: 'test' });

    withCustomOptions.example([
      ['$0 accounts info', i18n(`${i18nKey}.examples.default`)],
      ['$0 accounts info MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
      ['$0 accounts info 1234567', i18n(`${i18nKey}.examples.idBased`)],
    ]);

    return withCustomOptions;
  }
}

export default Info;
module.exports = Info;
