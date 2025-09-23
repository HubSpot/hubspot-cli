import { ArgumentsCamelCase, Argv } from 'yargs';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  setDefaultCmsPublishMode,
  setHttpTimeout,
  setAllowUsageTracking,
  setAllowAutoUpdates,
  setAutoOpenBrowser,
} from '../../lib/configOptions.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { commands } from '../../lang/en.js';
import {
  makeYargsBuilder,
  strictEnforceBoolean,
} from '../../lib/yargsUtils.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { uiLogger } from '../../lib/ui/logger.js';

const command = 'set';
const describe = commands.config.subcommands.set.describe;

type ConfigSetArgs = CommonArgs &
  ConfigArgs & {
    defaultCmsPublishMode?: CmsPublishMode;
    allowUsageTracking?: boolean;
    httpTimeout?: string;
    allowAutoUpdates?: boolean;
    autoOpenBrowser?: boolean;
  };

async function selectOptions(): Promise<ConfigSetArgs> {
  const { configOption } = await promptUser<{
    configOption: ConfigSetArgs;
  }>([
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
): Promise<void> {
  const {
    allowAutoUpdates,
    allowUsageTracking,
    defaultCmsPublishMode,
    httpTimeout,
    autoOpenBrowser,
  } = args;

  if (allowAutoUpdates !== undefined) {
    await setAllowAutoUpdates({ allowAutoUpdates, accountId });
  }

  if (allowUsageTracking !== undefined) {
    await setAllowUsageTracking({ allowUsageTracking, accountId });
  }

  if (autoOpenBrowser !== undefined) {
    await setAutoOpenBrowser({ autoOpenBrowser, accountId });
  }

  if (defaultCmsPublishMode !== undefined) {
    await setDefaultCmsPublishMode({ defaultCmsPublishMode, accountId });
  }

  if (httpTimeout !== undefined) {
    await setHttpTimeout({ httpTimeout, accountId });
  }
}

async function handler(args: ArgumentsCamelCase<ConfigSetArgs>): Promise<void> {
  const {
    derivedAccountId,
    allowAutoUpdates,
    allowUsageTracking,
    defaultCmsPublishMode,
    httpTimeout,
    autoOpenBrowser,
  } = args;

  trackCommandUsage('config-set', {}, derivedAccountId);

  try {
    if (
      allowAutoUpdates !== undefined ||
      allowUsageTracking !== undefined ||
      autoOpenBrowser !== undefined ||
      defaultCmsPublishMode !== undefined ||
      httpTimeout !== undefined
    ) {
      await handleConfigUpdate(derivedAccountId, args);
    } else {
      const selectedOptions = await selectOptions();
      await handleConfigUpdate(derivedAccountId, selectedOptions);
    }
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function configSetBuilder(yargs: Argv): Argv<ConfigSetArgs> {
  yargs
    .options({
      'default-cms-publish-mode': {
        describe: commands.config.subcommands.set.options.defaultMode.describe,
        type: 'string',
        choices: ['draft', 'publish'],
      },
      'http-timeout': {
        describe: commands.config.subcommands.set.options.httpTimeout.describe,
        type: 'number',
        coerce: (value: number) => {
          if (isNaN(value) || value < 3000) {
            uiLogger.error(
              commands.config.subcommands.set.errors.invalidHTTPTimeout
            );
            process.exit(EXIT_CODES.ERROR);
          }
          return value;
        },
      },
      'allow-usage-tracking': {
        describe:
          commands.config.subcommands.set.options.allowUsageTracking.describe,
        type: 'boolean',
      },
      'allow-auto-updates': {
        describe:
          commands.config.subcommands.set.options.allowAutoUpdates.describe,
        type: 'boolean',
        hidden: true,
      },
      'auto-open-browser': {
        describe:
          commands.config.subcommands.set.options.autoOpenBrowser.describe,
        type: 'boolean',
      },
    })
    .check(() => {
      // Use process.argv directly because yargs argv has already been parsed/coerced,
      // but we need to validate the exact format the user provided (e.g., --flag=true vs --flag)
      return strictEnforceBoolean(process.argv, [
        'allow-usage-tracking',
        'allow-auto-updates',
        'auto-open-browser',
      ]);
    })
    .example([
      ['$0 config set', commands.config.subcommands.set.examples.default],
      ['$0 config set --allow-usage-tracking=false', 'Disable usage tracking'],
      ['$0 config set --http-timeout=5000', 'Set HTTP timeout to 5000ms'],
      [
        '$0 config set --default-cms-publish-mode=draft',
        'Set default CMS publish mode to draft',
      ],
      [
        '$0 config set --http-timeout=3000 --allow-usage-tracking=false',
        'Set HTTP timeout and disable usage tracking',
      ],
      [
        '$0 config set --default-cms-publish-mode=draft --http-timeout=4000 --allow-usage-tracking=true',
        'Configure multiple settings at once',
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
