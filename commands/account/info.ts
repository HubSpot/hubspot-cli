import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAccountConfig,
  getDisplayDefaultAccount,
  getConfigDefaultAccount,
  getDefaultAccountOverrideFilePath,
  getConfigPath,
} from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { indent } from '../../lib/ui/index';
import { getTableContents } from '../../lib/ui/table';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.info';

export const describe = i18n(`${i18nKey}.describe`);
export const command = 'info [account]';

type AccountInfoArgs = CommonArgs & ConfigArgs;

export async function handler(
  args: ArgumentsCamelCase<AccountInfoArgs>
): Promise<void> {
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

    // If a default account is present in the config, display it
    const configPath = getConfigPath();
    if (configPath) {
      logger.log(i18n(`${i18nKey}.defaultAccountTitle`));
      logger.log(
        indent(1) +
          i18n(`${i18nKey}.configPath`, {
            configPath,
          })
      );
      logger.log(
        indent(1) +
          i18n(`${i18nKey}.defaultAccount`, {
            account: getDisplayDefaultAccount()!,
          })
      );
    }

    // If a default account override is present, display it
    const overrideFilePath = getDefaultAccountOverrideFilePath();
    if (overrideFilePath) {
      logger.log('');
      logger.log(i18n(`${i18nKey}.overrideFilePathTitle`));
      logger.log(
        indent(1) + i18n(`${i18nKey}.overrideFilePath`, { overrideFilePath })
      );
      logger.log(
        indent(1) +
          i18n(`${i18nKey}.overrideAccount`, {
            account: getConfigDefaultAccount()!,
          })
      );
    }

    logger.log('');
    logger.log(i18n(`${i18nKey}.name`, { name: name! }));
    logger.log(i18n(`${i18nKey}.accountId`, { accountId: derivedAccountId }));
    logger.log(i18n(`${i18nKey}.scopeGroups`));
    logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
  } else {
    logger.log(i18n(`${i18nKey}.errors.notUsingPersonalAccessKey`));
  }
}

export function builder(yargs: Argv): Argv<AccountInfoArgs> {
  addConfigOptions(yargs);

  yargs.example([
    ['$0 accounts info', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts info MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
    ['$0 accounts info 1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs as Argv<AccountInfoArgs>;
}
