import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  getConfigPath,
  configFileExists,
  updateAccountConfig,
  writeConfig,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';

import { addConfigOptions, addGlobalOptions } from '../../lib/commonOpts';
import { handleExit } from '../../lib/process';
import { logError } from '../../lib/errorHandlers/index';
import { i18n } from '../../lib/lang';
import { trackCommandUsage } from '../../lib/usageTracking';
import { addTestingOptions } from '../../lib/commonOpts';
import { personalAccessKeyPrompt } from '../../lib/prompts/personalAccessKeyPrompt';
import { cliAccountNamePrompt } from '../../lib/prompts/accountNamePrompt';
import { setAsDefaultAccountPrompt } from '../../lib/prompts/setAsDefaultAccountPrompt';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiFeatureHighlight } from '../../lib/ui';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.auth';

async function createOrUpdateConfig(
  env: Environment,
  doesConfigExist: boolean,
  account?: number
): Promise<CLIAccount | null> {
  try {
    const { personalAccessKey } = await personalAccessKeyPrompt({
      env,
      account,
    });
    const token = await getAccessToken(personalAccessKey, env);
    const defaultName = token.hubName ? toKebabCase(token.hubName) : null;

    const name = doesConfigExist
      ? undefined
      : (await cliAccountNamePrompt(defaultName)).name;

    const updatedConfig = await updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env,
      name,
      !doesConfigExist
    );

    if (!updatedConfig) return null;

    if (doesConfigExist && !updatedConfig.name) {
      updatedConfig.name = (await cliAccountNamePrompt(defaultName)).name;
    }

    if (doesConfigExist) {
      updateAccountConfig({
        ...updatedConfig,
        environment: updatedConfig.env,
        tokenInfo: updatedConfig.auth!.tokenInfo,
      });
      writeConfig();
    }

    return updatedConfig;
  } catch (e) {
    logError(e);
    return null;
  }
}

export const describe = null; // i18n(`${i18nKey}.describe`);
export const command = 'auth';

type AccountInfoArgs = CommonArgs & ConfigArgs;

export async function handler(
  args: ArgumentsCamelCase<AccountInfoArgs>
): Promise<void> {
  const { providedAccountId, disableTracking } = args;

  if (!disableTracking) {
    trackCommandUsage('account-auth', {}, providedAccountId);
  }

  const env = args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  const configExists = configFileExists(true);

  if (!configExists) {
    createEmptyConfigFile({}, true);
  }
  loadConfig('');

  handleExit(deleteEmptyConfigFile);

  try {
    const updatedConfig = await createOrUpdateConfig(
      env,
      configExists,
      providedAccountId
    );

    if (!updatedConfig) {
      logger.error(i18n(`${i18nKey}.errors.failedToUpdateConfig`));
      process.exit(EXIT_CODES.ERROR);
    }

    // @ts-ignore TODO
    const { name, accountId } = updatedConfig;

    // If the config file was just created, we don't need to prompt the user to set as default
    if (!configExists) {
      logger.log('');
      logger.success(
        i18n(`${i18nKey}.success.configFileCreated`, {
          configPath: getConfigPath('', true)!,
        })
      );
      logger.success(
        i18n(`${i18nKey}.success.configFileUpdated`, {
          account: name || accountId,
        })
      );
    }

    if (configExists) {
      const setAsDefault = await setAsDefaultAccountPrompt(name!);

      logger.log('');
      if (setAsDefault) {
        logger.success(
          i18n(`lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
            accountName: name!,
          })
        );
      } else {
        logger.info(
          i18n(`lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`, {
            accountName: getConfigDefaultAccount()!,
          })
        );
      }
    }
    uiFeatureHighlight(['helpCommand', 'authCommand', 'accountsListCommand']);

    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<AccountInfoArgs> {
  yargs.options({
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
      alias: 'a',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
  });

  addConfigOptions(yargs);
  addTestingOptions(yargs);
  addGlobalOptions(yargs);

  return yargs as Argv<AccountInfoArgs>;
}
