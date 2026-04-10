import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigAccountById,
  getConfigAccountEnvironment,
} from '@hubspot/local-dev-lib/config';
import { uiLogger } from '../../lib/ui/logger.js';
import { isMissingScopeError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { commands, lib } from '../../lang/en.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiFeatureHighlight, uiBetaTag } from '../../lib/ui/index.js';
import {
  SANDBOX_TYPE_MAP,
  validateSandboxUsageLimits,
} from '../../lib/sandboxes.js';
import { sandboxTypePrompt } from '../../lib/prompts/sandboxesPrompt.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { buildV2Sandbox } from '../../lib/buildAccount.js';
import { hubspotAccountNamePrompt } from '../../lib/prompts/accountNamePrompt.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'create';
const describe = uiBetaTag(commands.sandbox.subcommands.create.describe, false);

export type SandboxCreateArgs = CommonArgs &
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
  const { name, type, force, derivedAccountId, exit } = args;
  const accountConfig = getConfigAccountById(derivedAccountId);
  const env = getConfigAccountEnvironment(derivedAccountId);

  // Check if account config exists
  if (!accountConfig) {
    uiLogger.error(
      commands.sandbox.subcommands.create.failure.noAccountConfig(
        derivedAccountId
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  // Default account is not a production portal
  if (
    accountConfig.accountType &&
    accountConfig.accountType !== HUBSPOT_ACCOUNT_TYPES.STANDARD
  ) {
    uiLogger.error(
      commands.sandbox.subcommands.create.failure.invalidAccountType(
        HUBSPOT_ACCOUNT_TYPE_STRINGS[
          HUBSPOT_ACCOUNT_TYPES[
            accountConfig.accountType as keyof typeof HUBSPOT_ACCOUNT_TYPES
          ]
        ],
        accountConfig.name || ''
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  let typePrompt;
  let namePrompt;

  if ((type && !(type.toLowerCase() in SANDBOX_TYPE_MAP)) || !type) {
    if (!force) {
      typePrompt = await sandboxTypePrompt();
    } else {
      uiLogger.error(
        commands.sandbox.subcommands.create.failure.optionMissing.type
      );
      return exit(EXIT_CODES.ERROR);
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
      uiLogger.error(
        sandboxType === 'DEVELOPMENT_SANDBOX'
          ? lib.sandbox.create.developer.failure.scopes.message
          : lib.sandbox.create.standard.failure.scopes.message
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${derivedAccountId}`;
      uiLogger.info(
        sandboxType === 'DEVELOPMENT_SANDBOX'
          ? lib.sandbox.create.developer.failure.scopes.instructions(
              accountConfig.name || derivedAccountId,
              url
            )
          : lib.sandbox.create.standard.failure.scopes.instructions(
              accountConfig.name || derivedAccountId,
              url
            )
      );
    } else {
      logError(err);
    }
    return exit(EXIT_CODES.ERROR);
  }

  if (!name) {
    if (!force) {
      namePrompt = await hubspotAccountNamePrompt({ accountType: sandboxType });
    } else {
      uiLogger.error(
        commands.sandbox.subcommands.create.failure.optionMissing.name
      );
      return exit(EXIT_CODES.ERROR);
    }
  }

  const maybeSandboxName = name || (namePrompt && namePrompt.name);
  if (!maybeSandboxName) {
    uiLogger.error(
      commands.sandbox.subcommands.create.failure.optionMissing.name
    );
    return exit(EXIT_CODES.ERROR);
  }
  const sandboxName: string = maybeSandboxName;

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
          message: commands.sandbox.sync.confirm.syncContactRecords.standard,
        },
      ]);
      contactRecordsSyncPromptResult = contactRecordsSyncPrompt;
    }
  }

  try {
    const result = await buildV2Sandbox(
      sandboxName,
      accountConfig,
      sandboxType,
      contactRecordsSyncPromptResult,
      env,
      force
    );

    const sandboxAccountConfig = getConfigAccountById(
      result.sandbox.sandboxHubId
    );
    // Check if sandbox account config exists
    if (!sandboxAccountConfig) {
      uiLogger.error(
        commands.sandbox.subcommands.create.failure.noSandboxAccountConfig(
          result.sandbox.sandboxHubId
        )
      );
      return exit(EXIT_CODES.ERROR);
    }

    const highlightItems = ['accountsUseCommand', 'projectCreateCommand'];
    if (sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      highlightItems.push('projectDevCommand');
    } else {
      highlightItems.push('projectUploadCommand');
    }

    uiFeatureHighlight(highlightItems);
    return exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Errors are logged in util functions
    return exit(EXIT_CODES.ERROR);
  }
}

function sandboxCreateBuilder(yargs: Argv): Argv<SandboxCreateArgs> {
  yargs.option('force', {
    type: 'boolean',
    alias: 'f',
    describe: commands.sandbox.subcommands.create.options.force.describe,
  });
  yargs.option('name', {
    describe: commands.sandbox.subcommands.create.options.name.describe,
    type: 'string',
  });
  yargs.option('type', {
    describe: commands.sandbox.subcommands.create.options.type.describe,
    choices: Object.keys(SANDBOX_TYPE_MAP),
  });

  yargs.example([
    [
      '$0 sandbox create --name=MySandboxAccount --type=standard',
      commands.sandbox.subcommands.create.examples.default,
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
  handler: makeYargsHandlerWithUsageTracking('sandbox-create', handler),
  builder,
};

export default sandboxCreateCommand;
