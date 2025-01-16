import { Argv, ArgumentsCamelCase, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { getTableContents } from '../../lib/ui/table';
import { CommonOptions } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.info';

export class AccountInfoCommand<U extends CommonOptions>
  implements CommandModule<object, U>
{
  public command = 'info [account]';
  public describe = i18n(`${i18nKey}.describe`);

  public builder = (args: Argv): Argv<U> => {
    addConfigOptions(args);

    args.example([
      ['$0 accounts info', i18n(`${i18nKey}.examples.default`)],
      ['$0 accounts info MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
      ['$0 accounts info 1234567', i18n(`${i18nKey}.examples.idBased`)],
    ]);

    return args as unknown as Argv<U>;
  };

  public handler = async (args: ArgumentsCamelCase<U>) => {
    const { derivedAccountId } = args;
    const config = getAccountConfig(derivedAccountId);
    // check if the provided account is using a personal access key, if not, show an error
    if (config && config.authType === 'personalaccesskey') {
      const { name, personalAccessKey, env } = config;
      let scopeGroups: string[][] = [];

      const response = await getAccessToken(
        personalAccessKey!,
        env,
        derivedAccountId
      );

      scopeGroups = response.scopeGroups.map(s => [s]);

      if (name) {
        logger.log(i18n(`${i18nKey}.name`, { name }));
      }
      logger.log(i18n(`${i18nKey}.accountId`, { accountId: derivedAccountId }));
      logger.log(i18n(`${i18nKey}.scopeGroups`));
      logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
    } else {
      logger.log(i18n(`${i18nKey}.errors.notUsingPersonalAccessKey`));
    }
  };
}
