import { ArgumentsCamelCase, Argv } from 'yargs';

import { i18n } from '../../lib/lang';
import { trackCommandUsage } from '../../lib/usageTracking';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  setDefaultCmsPublishMode,
  setHttpTimeout,
  setAllowUsageTracking,
} from '../../lib/configOptions';
import { CommonArgs } from '../../types/Yargs';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';

const i18nKey = 'commands.config.subcommands.set';

export const command = 'set';
export const describe = i18n(`${i18nKey}.describe`);

async function selectOptions(): Promise<ConfigSetArgs> {
  const { cmsPublishMode } = await promptUser([
    {
      type: 'list',
      name: 'cmsPublishMode',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: [
        {
          name: 'Default CMS publish mode',
          value: { defaultCmsPublishMode: '' },
        },
        { name: 'Allow usage tracking', value: { allowUsageTracking: '' } },
        { name: 'HTTP timeout', value: { httpTimeout: '' } },
      ],
    },
  ]);

  return cmsPublishMode;
}

async function handleConfigUpdate(
  accountId: number,
  options: ConfigSetArgs
): Promise<boolean> {
  const { allowUsageTracking, defaultCmsPublishMode, httpTimeout } = options;

  if (typeof defaultCmsPublishMode !== 'undefined') {
    await setDefaultCmsPublishMode({ defaultCmsPublishMode, accountId });
    return true;
  } else if (typeof httpTimeout !== 'undefined') {
    await setHttpTimeout({ httpTimeout, accountId });
    return true;
  } else if (typeof allowUsageTracking !== 'undefined') {
    await setAllowUsageTracking({ allowUsageTracking, accountId });
    return true;
  }

  return false;
}

type ConfigSetArgs = CommonArgs & {
  defaultCmsPublishMode: CmsPublishMode;
  allowUsageTracking?: boolean;
  httpTimeout?: string;
};

export async function handler(
  args: ArgumentsCamelCase<ConfigSetArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('config-set', {}, derivedAccountId);

  const configUpdated = await handleConfigUpdate(derivedAccountId, args);

  if (!configUpdated) {
    const selectedOptions = await selectOptions();

    await handleConfigUpdate(derivedAccountId, selectedOptions);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<ConfigSetArgs> {
  yargs
    .options({
      'default-cms-publish-mode': {
        describe: i18n(`${i18nKey}.options.defaultMode.describe`),
        type: 'string',
      },
      'allow-usage-tracking': {
        describe: i18n(`${i18nKey}.options.allowUsageTracking.describe`),
        type: 'boolean',
      },
      'http-timeout': {
        describe: i18n(`${i18nKey}.options.httpTimeout.describe`),
        type: 'string',
      },
    })
    .conflicts('defaultCmsPublishMode', 'allowUsageTracking')
    .conflicts('defaultCmsPublishMode', 'httpTimeout')
    .conflicts('allowUsageTracking', 'httpTimeout')
    .example([['$0 config set', i18n(`${i18nKey}.examples.default`)]]);

  return yargs as Argv<ConfigSetArgs>;
}
