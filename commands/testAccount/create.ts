import fs from 'fs-extra';
import path from 'path';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { DeveloperTestAccountConfig } from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { getEnv } from '@hubspot/local-dev-lib/config';
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
  createDeveloperTestAccountV3,
  saveAccountToConfig,
} from '../../lib/buildAccount.js';

const command = 'create';
const describe = commands.testAccount.create.describe;

type CreateTestAccountArgs = CommonArgs &
  AccountArgs &
  ConfigArgs &
  TestingArgs &
  EnvironmentArgs &
  JSONOutputArgs & {
    configPath?: string;
  };

async function handler(
  args: ArgumentsCamelCase<CreateTestAccountArgs>
): Promise<void> {
  const { derivedAccountId, configPath, formatOutputAsJson } = args;

  trackCommandUsage('test-account-create', {}, derivedAccountId);

  const env = getValidEnv(getEnv(derivedAccountId));

  let accountConfigPath: string | undefined = configPath;
  let testAccountConfig: DeveloperTestAccountConfig;

  if (!accountConfigPath) {
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
      accountConfigPath = configPathPromptResult.configPath;
    }
  }

  if (accountConfigPath) {
    const absoluteConfigPath = path.resolve(getCwd(), accountConfigPath);

    if (!fileExists(absoluteConfigPath)) {
      uiLogger.error(
        commands.testAccount.create.errors.configFileNotFound(
          absoluteConfigPath
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }

    try {
      testAccountConfig = JSON.parse(
        fs.readFileSync(absoluteConfigPath, 'utf8')
      );
    } catch (err) {
      uiLogger.error(
        commands.testAccount.create.errors.configFileParseFailed(
          absoluteConfigPath
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    testAccountConfig = await createDeveloperTestAccountConfigPrompt();
  }

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
    const createResult = await createDeveloperTestAccountV3(
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
      await saveAccountToConfig(
        resultJson.accountId,
        testAccountConfig.accountName,
        env,
        resultJson.personalAccessKey
      );
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

  yargs.example([
    [
      '$0 create --config-path ./test-account-config.json',
      commands.testAccount.create.example('./test-account-config.json'),
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
