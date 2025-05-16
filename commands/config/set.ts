import { ArgumentsCamelCase, Argv } from 'yargs';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { i18n } from '../../lib/lang';
import { trackCommandUsage } from '../../lib/usageTracking';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  setDefaultCmsPublishMode,
  setHttpTimeout,
  setAllowUsageTracking,
  setAllowAutoUpdates,
} from '../../lib/configOptions';
import { CommonArgs, ConfigArgs, YargsCommandModule } from '../../types/Yargs';
import { commands } from '../../lang/en';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'set';
const describe = commands.config.subcommands.set.describe;

async function selectOptions(): Promise<ConfigSetArgs> {
  const { configOption } = await promptUser([
    {
      type: 'list',
      name: 'configOption',
      pageSize: 20,
      message: commands.config.subcommands.set.promptMessage,
      choices: [
        {
          name: 'Default CMS publish mode',
          value: { defaultCmsPublishMode: '' },
        },
        { name: 'Allow usage tracking', value: { allowUsageTracking: '' } },
        { name: 'HTTP timeout', value: { httpTimeout: '' } },
        // TODO enable when we unhide this option { name: 'Allow auto updates', value: { allowAutoUpdates: '' } },
      ],
    },
  ]);

  return configOption;
}

async function handleConfigUpdate(
  accountId: number,
  args: ConfigSetArgs
): Promise<boolean> {
  const {
    allowAutoUpdates,
    allowUsageTracking,
    defaultCmsPublishMode,
    httpTimeout,
  } = args;

  if (typeof defaultCmsPublishMode !== 'undefined') {
    await setDefaultCmsPublishMode({ defaultCmsPublishMode, accountId });
    return true;
  } else if (typeof httpTimeout !== 'undefined') {
    await setHttpTimeout({ httpTimeout, accountId });
    return true;
  } else if (typeof allowUsageTracking !== 'undefined') {
    await setAllowUsageTracking({ allowUsageTracking, accountId });
    return true;
  } else if (typeof allowAutoUpdates !== 'undefined') {
    await setAllowAutoUpdates({ allowAutoUpdates, accountId });
    return true;
  }

  return false;
}

type ConfigSetArgs = CommonArgs &
  ConfigArgs & {
    defaultCmsPublishMode: CmsPublishMode;
    allowUsageTracking?: boolean;
    httpTimeout?: string;
    allowAutoUpdates?: boolean;
  };

async function handler(args: ArgumentsCamelCase<ConfigSetArgs>): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('config-set', {}, derivedAccountId);

  const configUpdated = await handleConfigUpdate(derivedAccountId, args);

  if (!configUpdated) {
    const selectedOptions = await selectOptions();

    await handleConfigUpdate(derivedAccountId, selectedOptions);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function configSetBuilder(yargs: Argv): Argv<ConfigSetArgs> {
  yargs
    .options({
      'default-cms-publish-mode': {
        describe: commands.config.subcommands.set.options.defaultMode.describe,
        type: 'string',
      },
      'allow-usage-tracking': {
        describe:
          commands.config.subcommands.set.options.allowUsageTracking.describe,
        type: 'boolean',
      },
      'http-timeout': {
        describe: commands.config.subcommands.set.options.httpTimeout.describe,
        type: 'string',
      },
      'allow-auto-updates': {
        describe:
          commands.config.subcommands.set.options.allowAutoUpdates.describe,
        type: 'boolean',
        hidden: true,
      },
    })
    .conflicts('defaultCmsPublishMode', 'allowUsageTracking')
    .conflicts('defaultCmsPublishMode', 'httpTimeout')
    .conflicts('allowUsageTracking', 'httpTimeout')
    .conflicts('allowAutoUpdates', 'defaultCmsPublishMode')
    .conflicts('allowAutoUpdates', 'allowUsageTracking')
    .conflicts('allowAutoUpdates', 'httpTimeout')
    .example([
      [
        '$0 config set',
        i18n(`commands.config.subcommands.set.examples.default`),
      ],
    ]);

  return yargs as Argv<ConfigSetArgs>;
}

const builder = makeYargsBuilder<ConfigSetArgs>(
  configSetBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const configSetCommand: YargsCommandModule<unknown, ConfigSetArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default configSetCommand;
