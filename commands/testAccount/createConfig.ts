import fs from 'fs-extra';
import path from 'path';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { createDeveloperTestAccountConfigPrompt } from '../../lib/prompts/createDeveloperTestAccountConfigPrompt.js';
import { fileExists } from '../../lib/validation.js';

const command = 'create-config';
const describe = commands.testAccount.createConfig.describe;

type CreateTestAccountConfigArgs = CommonArgs & {
  name?: string;
  description?: string;
  path?: string;
};

async function handler(
  args: ArgumentsCamelCase<CreateTestAccountConfigArgs>
): Promise<void> {
  const { derivedAccountId, name, description, path: configPath } = args;

  trackCommandUsage('test-account-create-config', {}, derivedAccountId);

  let accountConfigPath = configPath;

  const testAccountConfig = await createDeveloperTestAccountConfigPrompt({
    name,
    description,
  });

  if (!accountConfigPath) {
    const pathPromptResult = await promptUser({
      name: 'path',
      message: commands.testAccount.createConfig.pathPrompt,
      type: 'input',
      default:
        testAccountConfig.accountName.toLowerCase().replace(/\s+/g, '-') +
        '.json',
      validate: path => {
        if (!path) {
          return commands.testAccount.createConfig.errors.pathError;
        } else if (!path.endsWith('.json')) {
          return commands.testAccount.createConfig.errors.pathFormatError;
        } else if (fileExists(path)) {
          return commands.testAccount.createConfig.errors.pathExistsError;
        }
        return true;
      },
    });
    accountConfigPath = pathPromptResult.path;
  }

  if (!accountConfigPath) {
    uiLogger.error(commands.testAccount.createConfig.errors.pathError);
    process.exit(EXIT_CODES.ERROR);
  }

  if (fileExists(accountConfigPath)) {
    uiLogger.error(commands.testAccount.createConfig.errors.pathExistsError);
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    fs.writeFileSync(
      path.resolve(getCwd(), accountConfigPath),
      JSON.stringify(testAccountConfig, null, 2),
      'utf8'
    );
  } catch (err) {
    uiLogger.error(commands.testAccount.createConfig.errors.failedToCreate);
    process.exit(EXIT_CODES.ERROR);
  }

  uiLogger.success(
    commands.testAccount.createConfig.success.configFileCreated(
      accountConfigPath
    )
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function createTestAccountConfigBuilder(
  yargs: Argv
): Argv<CreateTestAccountConfigArgs> {
  yargs.option('name', {
    type: 'string',
    description: commands.testAccount.createConfig.options.name,
  });
  yargs.option('description', {
    type: 'string',
    description: commands.testAccount.createConfig.options.description,
  });
  yargs.option('path', {
    type: 'string',
    description: commands.testAccount.createConfig.options.path,
  });
  yargs.example([
    [
      '$0 test-account create-config --name my-account',
      commands.testAccount.createConfig.example('my-account'),
    ],
  ]);
  return yargs as Argv<CreateTestAccountConfigArgs>;
}

const builder = makeYargsBuilder<CreateTestAccountConfigArgs>(
  createTestAccountConfigBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const createTestAccountConfigCommand: YargsCommandModule<
  unknown,
  CreateTestAccountConfigArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default createTestAccountConfigCommand;
