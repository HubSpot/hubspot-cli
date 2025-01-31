import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
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
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiFeatureHighlight } from '../../lib/ui';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.auth';

async function createPersonalAccessKeyConfig(
  env: Environment,
  account?: number,
  doesConfigExist = false
): Promise<CLIAccount | null | undefined> {
  const { personalAccessKey } = await personalAccessKeyPrompt({ env, account });
  let updatedConfig;
  let defaultName;
  let validName;

  try {
    const token = await getAccessToken(personalAccessKey, env);
    defaultName = token.hubName ? toKebabCase(token.hubName) : null;
    const { name: namePrompt } = await cliAccountNamePrompt(defaultName);
    validName = namePrompt;

    updatedConfig = await updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env,
      validName,
      !doesConfigExist
    );
  } catch (e) {
    logError(e);
  }
  return updatedConfig;
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

  createEmptyConfigFile({}, true);
  // @ts-ignore TODO
  loadConfig('', true);

  handleExit(deleteEmptyConfigFile);

  try {
    const doesConfigExist = Boolean(getConfigPath('', true));
    // @ts-ignore TODO
    const { name, accountId } = await createPersonalAccessKeyConfig(
      env,
      providedAccountId,
      doesConfigExist
    );

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
