import fs from 'fs-extra';
import path from 'path';
import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  AccountLevel,
  DeveloperTestAccountConfig,
} from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';
import { getCwd } from '@hubspot/local-dev-lib/path';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  TestingArgs,
  YargsCommandModule,
  EnvironmentArgs,
  JSONOutputArgs,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { promptUser, listPrompt } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { fileExists } from '../../lib/validation.js';
import { commands } from '../../lang/en.js';
import { createDeveloperTestAccountConfigPrompt } from '../../lib/prompts/createDeveloperTestAccountConfigPrompt.js';
import { debugError, logError } from '../../lib/errorHandlers/index.js';
import SpinniesManager from '../../lib/ui/SpinniesManager.js';
import {
  createDeveloperTestAccountV2,
  saveAccountToConfig,
} from '../../lib/buildAccount.js';
import { ACCOUNT_LEVEL_CHOICES } from '../../lib/constants.js';

const command = 'create';
const describe = commands.testAccount.create.describe;

type CreateTestAccountArgs = CommonArgs &
  AccountArgs &
  ConfigArgs &
  TestingArgs &
  EnvironmentArgs &
  JSONOutputArgs & {
    configPath?: string;
    name?: string;
    description?: string;
    marketingLevel?: AccountLevel;
    opsLevel?: AccountLevel;
    serviceLevel?: AccountLevel;
    salesLevel?: AccountLevel;
    contentLevel?: AccountLevel;
  };

function hasAnyFlags(args: ArgumentsCamelCase<CreateTestAccountArgs>): boolean {
  const {
    name,
    description,
    marketingLevel,
    opsLevel,
    serviceLevel,
    salesLevel,
    contentLevel,
  } = args;
  return !!(
    name ||
    description ||
    marketingLevel ||
    opsLevel ||
    serviceLevel ||
    salesLevel ||
    contentLevel
  );
}

async function readConfigFile(
  configPath: string
): Promise<DeveloperTestAccountConfig> {
  const absoluteConfigPath = path.resolve(getCwd(), configPath);

  if (!fileExists(absoluteConfigPath)) {
    uiLogger.error(
      commands.testAccount.create.errors.configFileNotFound(absoluteConfigPath)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    return JSON.parse(fs.readFileSync(absoluteConfigPath, 'utf8'));
  } catch (err) {
    uiLogger.error(
      commands.testAccount.create.errors.configFileParseFailed(
        absoluteConfigPath
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }
}

async function promptForConfigPath(): Promise<string | undefined> {
  const createTestAccountFromConfig = await listPrompt(
    commands.testAccount.create.createTestAccountFromConfigPrompt,
    {
      choices: [
        {
          name: commands.testAccount.create.createFromConfigOption,
          value: true,
        },
        {
          name: commands.testAccount.create.createFromScratchOption,
          value: false,
        },
      ],
    }
  );

  if (createTestAccountFromConfig) {
    const configPathPromptResult = await promptUser({
      name: 'configPath',
      message: commands.testAccount.create.configPathPrompt,
      type: 'input',
    });
    return configPathPromptResult.configPath;
  }

  return undefined;
}

async function buildTestAccountConfig(
  args: ArgumentsCamelCase<CreateTestAccountArgs>
): Promise<DeveloperTestAccountConfig> {
  const {
    configPath,
    name,
    description,
    marketingLevel,
    opsLevel,
    serviceLevel,
    salesLevel,
    contentLevel,
  } = args;

  if (configPath) {
    return readConfigFile(configPath);
  }

  let accountConfigPath: string | undefined;

  if (!hasAnyFlags(args)) {
    accountConfigPath = await promptForConfigPath();
  }

  if (accountConfigPath) {
    return readConfigFile(accountConfigPath);
  }

  return createDeveloperTestAccountConfigPrompt({
    name,
    description,
    marketingLevel,
    opsLevel,
    serviceLevel,
    salesLevel,
    contentLevel,
  });
}

async function handler(
  args: ArgumentsCamelCase<CreateTestAccountArgs>
): Promise<void> {
  const { derivedAccountId, formatOutputAsJson } = args;

  trackCommandUsage('test-account-create', {}, derivedAccountId);

  const env = getValidEnv(getConfigAccountEnvironment(derivedAccountId));

  const testAccountConfig = await buildTestAccountConfig(args);

  const resultJson: {
    accountName?: string;
    accountId?: number;
    personalAccessKey?: string;
  } = {};

  SpinniesManager.init({
    succeedColor: 'white',
  });

  SpinniesManager.add('createTestAccount', {
    text: commands.testAccount.create.polling.start(
      testAccountConfig.accountName
    ),
  });

  try {
    const createResult = await createDeveloperTestAccountV2(
      derivedAccountId,
      testAccountConfig
    );

    resultJson.accountName = createResult.accountName;
    resultJson.accountId = createResult.accountId;
    resultJson.personalAccessKey = createResult.personalAccessKey;
  } catch (err) {
    logError(err);
    SpinniesManager.fail('createTestAccount', {
      text: commands.testAccount.create.polling.createFailure,
    });
    process.exit(EXIT_CODES.ERROR);
  }

  SpinniesManager.succeed('createTestAccount', {
    text: commands.testAccount.create.polling.success(
      testAccountConfig.accountName,
      resultJson.accountId!
    ),
  });

  if (formatOutputAsJson) {
    uiLogger.json(resultJson);
  } else {
    // Only save to config if not using json output
    try {
      const savedAccountName = await saveAccountToConfig(
        resultJson.accountId,
        testAccountConfig.accountName,
        env,
        resultJson.personalAccessKey
      );

      // Inform user if the account name was normalized
      if (savedAccountName !== testAccountConfig.accountName) {
        uiLogger.log('');
        uiLogger.info(
          commands.testAccount.create.savedAccountNameDiffers(
            testAccountConfig.accountName,
            savedAccountName
          )
        );
      }
    } catch (e) {
      debugError(e);
      uiLogger.error(
        commands.testAccount.create.errors.saveAccountToConfigFailure(
          testAccountConfig.accountName
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function createTestAccountBuilder(yargs: Argv): Argv<CreateTestAccountArgs> {
  yargs.option('config-path', {
    type: 'string',
    description: commands.testAccount.create.options.configPath,
  });

  yargs.option('name', {
    type: 'string',
    description: commands.testAccount.create.options.accountName,
  });

  yargs.option('description', {
    type: 'string',
    description: commands.testAccount.create.options.description,
  });

  yargs.option('marketing-level', {
    type: 'string',
    description: commands.testAccount.create.options.marketingLevel,
    choices: ACCOUNT_LEVEL_CHOICES,
  });

  yargs.option('ops-level', {
    type: 'string',
    description: commands.testAccount.create.options.opsLevel,
    choices: ACCOUNT_LEVEL_CHOICES,
  });

  yargs.option('service-level', {
    type: 'string',
    description: commands.testAccount.create.options.serviceLevel,
    choices: ACCOUNT_LEVEL_CHOICES,
  });

  yargs.option('sales-level', {
    type: 'string',
    description: commands.testAccount.create.options.salesLevel,
    choices: ACCOUNT_LEVEL_CHOICES,
  });

  yargs.option('content-level', {
    type: 'string',
    description: commands.testAccount.create.options.contentLevel,
    choices: ACCOUNT_LEVEL_CHOICES,
  });

  yargs.conflicts('config-path', [
    'name',
    'description',
    'marketing-level',
    'ops-level',
    'service-level',
    'sales-level',
    'content-level',
  ]);

  yargs.example([
    ['$0 test-account create', 'Interactive mode - prompts for all options'],
    [
      '$0 test-account create --name "MyTestAccount"',
      'Provide name via flag, prompt for description and tier selection',
    ],
    [
      '$0 test-account create --name "MyTestAccount" --description "Test account"',
      'Provide name and description, prompt for tier selection',
    ],
    [
      '$0 test-account create --name "MyTestAccount" --marketing-level PROFESSIONAL',
      'Specify marketing tier, other tiers default to ENTERPRISE',
    ],
    [
      '$0 test-account create --config-path ./test-account-config.json',
      'Create from config file (mutually exclusive with other flags)',
    ],
  ]);
  return yargs as Argv<CreateTestAccountArgs>;
}

const builder = makeYargsBuilder<CreateTestAccountArgs>(
  createTestAccountBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useEnvironmentOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useTestingOptions: true,
    useJSONOutputOptions: true,
  }
);

const createTestAccountCommand: YargsCommandModule<
  unknown,
  CreateTestAccountArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default createTestAccountCommand;
