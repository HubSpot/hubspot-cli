import { Argv, ArgumentsCamelCase } from 'yargs';
import { getAccountConfig, getEnv } from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { isMissingScopeError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  uiFeatureHighlight,
  uiBetaTag,
  uiCommandReference,
} from '../../lib/ui';
import {
  SANDBOX_TYPE_MAP,
  getAvailableSyncTypes,
  SYNC_TYPES,
  validateSandboxUsageLimits,
} from '../../lib/sandboxes';
import { trackCommandUsage } from '../../lib/usageTracking';
import { sandboxTypePrompt } from '../../lib/prompts/sandboxesPrompt';
import { promptUser } from '../../lib/prompts/promptUtils';
import { syncSandbox } from '../../lib/sandboxSync';
import { logError } from '../../lib/errorHandlers/index';
import { buildSandbox } from '../../lib/buildAccount';
import { hubspotAccountNamePrompt } from '../../lib/prompts/accountNamePrompt';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { SandboxSyncTask } from '../../types/Sandboxes';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'create';
const describe = uiBetaTag(
  i18n(`commands.sandbox.subcommands.create.describe`),
  false
);

type SandboxCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs & {
    name?: string;
    force?: boolean;
    type?: string;
  };

async function handler(
  args: ArgumentsCamelCase<SandboxCreateArgs>
): Promise<void> {
  const { name, type, force, derivedAccountId } = args;
  const accountConfig = getAccountConfig(derivedAccountId);
  const env = getValidEnv(getEnv(derivedAccountId));

  trackCommandUsage('sandbox-create', {}, derivedAccountId);

  // Check if account config exists
  if (!accountConfig) {
    logger.error(
      i18n(`commands.sandbox.subcommands.create.failure.noAccountConfig`, {
        accountId: derivedAccountId,
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  // Default account is not a production portal
  if (
    accountConfig.accountType &&
    accountConfig.accountType !== HUBSPOT_ACCOUNT_TYPES.STANDARD
  ) {
    logger.error(
      i18n(`commands.sandbox.subcommands.create.failure.invalidAccountType`, {
        accountType:
          HUBSPOT_ACCOUNT_TYPE_STRINGS[
            HUBSPOT_ACCOUNT_TYPES[accountConfig.accountType]
          ],
        accountName: accountConfig.name || '',
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let typePrompt;
  let namePrompt;

  if ((type && !(type.toLowerCase() in SANDBOX_TYPE_MAP)) || !type) {
    if (!force) {
      typePrompt = await sandboxTypePrompt();
    } else {
      logger.error(
        i18n(`commands.sandbox.subcommands.create.failure.optionMissing.type`)
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const sandboxType = type
    ? SANDBOX_TYPE_MAP[type.toLowerCase()]
    : typePrompt!.type;

  // Check usage limits and exit if parent portal has no available sandboxes for the selected type
  try {
    await validateSandboxUsageLimits(accountConfig, sandboxType, env);
  } catch (err) {
    if (isMissingScopeError(err)) {
      logger.error(
        i18n('lib.sandbox.create.failure.scopes.message', {
          accountName: accountConfig.name || derivedAccountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${derivedAccountId}`;
      logger.info(
        i18n('lib.sandbox.create.failure.scopes.instructions', {
          accountName: accountConfig.name || derivedAccountId,
          url,
        })
      );
    } else {
      logError(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }

  if (!name) {
    if (!force) {
      namePrompt = await hubspotAccountNamePrompt({ accountType: sandboxType });
    } else {
      logger.error(
        i18n(`commands.sandbox.subcommands.create.failure.optionMissing.name`)
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }
  const sandboxName = name || namePrompt!.name;

  let contactRecordsSyncPromptResult = false;
  if (!force) {
    const isStandardSandbox =
      sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX;

    // Prompt to sync contact records for standard sandboxes only
    if (isStandardSandbox) {
      const { contactRecordsSyncPrompt } = await promptUser([
        {
          name: 'contactRecordsSyncPrompt',
          type: 'confirm',
          message: i18n('lib.sandbox.sync.confirm.syncContactRecords.standard'),
        },
      ]);
      contactRecordsSyncPromptResult = contactRecordsSyncPrompt;
    }
  }

  try {
    const result = await buildSandbox(
      sandboxName,
      accountConfig,
      sandboxType,
      env,
      force
    );

    const sandboxAccountConfig = getAccountConfig(result.sandbox.sandboxHubId);
    // Check if sandbox account config exists
    if (!sandboxAccountConfig) {
      logger.error(
        i18n(
          `commands.sandbox.subcommands.create.failure.noSandboxAccountConfig`,
          {
            accountId: result.sandbox.sandboxHubId,
            authCommand: uiCommandReference('hs auth'),
          }
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }

    // For v1 sandboxes, keep sync here. Once we migrate to v2, this will be handled by BE automatically
    async function handleSyncSandbox(
      syncTasks: SandboxSyncTask[]
    ): Promise<void> {
      await syncSandbox(sandboxAccountConfig!, accountConfig!, env, syncTasks);
    }
    try {
      let availableSyncTasks = await getAvailableSyncTypes(
        accountConfig,
        sandboxAccountConfig
      );

      if (!contactRecordsSyncPromptResult) {
        availableSyncTasks = availableSyncTasks.filter(
          t => t.type !== SYNC_TYPES.OBJECT_RECORDS
        );
      }
      await handleSyncSandbox(availableSyncTasks);
    } catch (err) {
      logError(err);
      throw err;
    }

    const highlightItems = ['accountsUseCommand', 'projectCreateCommand'];
    if (sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      highlightItems.push('projectDevCommand');
    } else {
      highlightItems.push('projectUploadCommand');
    }

    uiFeatureHighlight(highlightItems);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Errors are logged in util functions
    process.exit(EXIT_CODES.ERROR);
  }
}

function sandboxCreateBuilder(yargs: Argv): Argv<SandboxCreateArgs> {
  yargs.option('force', {
    type: 'boolean',
    alias: 'f',
    describe: i18n(
      `commands.sandbox.subcommands.create.options.force.describe`
    ),
  });
  yargs.option('name', {
    describe: i18n(`commands.sandbox.subcommands.create.options.name.describe`),
    type: 'string',
  });
  yargs.option('type', {
    describe: i18n(`commands.sandbox.subcommands.create.options.type.describe`),
    choices: Object.keys(SANDBOX_TYPE_MAP),
  });

  yargs.example([
    [
      '$0 sandbox create --name=MySandboxAccount --type=STANDARD',
      i18n(`commands.sandbox.subcommands.create.examples.default`),
    ],
  ]);

  return yargs as Argv<SandboxCreateArgs>;
}

const builder = makeYargsBuilder<SandboxCreateArgs>(
  sandboxCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: true,
  }
);

const sandboxCreateCommand: YargsCommandModule<unknown, SandboxCreateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default sandboxCreateCommand;
