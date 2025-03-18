import { Argv, ArgumentsCamelCase } from 'yargs';
import os from 'os';
import {
  configFileExists,
  getAndLoadConfigIfNeeded,
  getConfigPath,
  getConfig,
} from '@hubspot/local-dev-lib/config';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  HUBSPOT_CONFIGURATION_FOLDER,
  HUBSPOT_CONFIGURATION_FILE,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';

import { migrateConfig, mergeExistingConfigs } from '../../lib/configMigrate';
import { promptUser } from '../../lib/prompts/promptUtils';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

const i18nKey = 'commands.config.subcommands.migrate';
const globalConfigPath = `${os.homedir()}/${HUBSPOT_CONFIGURATION_FOLDER}/${HUBSPOT_CONFIGURATION_FILE}`;

export const describe = i18n(`${i18nKey}.describe`, {
  deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  globalConfigPath,
});
export const command = 'migrate';

type ConfigMigrateArgs = CommonArgs & ConfigArgs;

async function handleMigration(
  args: ArgumentsCamelCase<ConfigMigrateArgs>,
  configPath?: string
) {
  const { shouldMigrateConfig } = await promptUser({
    name: 'shouldMigrateConfig',
    type: 'confirm',
    message: i18n(`${i18nKey}.migrateConfigPrompt`, {
      deprecatedConfigPath:
        getConfigPath(configPath, false, true) ||
        DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      globalConfigPath,
    }),
  });

  if (!shouldMigrateConfig) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  // @ts-ignore TODO
  const deprecatedConfig = getAndLoadConfigIfNeeded(args, false, true);
  // @ts-ignore TODO
  migrateConfig(deprecatedConfig);
  logger.log(
    i18n(`${i18nKey}.migrationSuccess`, {
      globalConfigPath,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

async function handleMerge(
  args: ArgumentsCamelCase<ConfigMigrateArgs>,
  configPath?: string
) {
  const { shouldMergeConfigs } = await promptUser({
    name: 'shouldMergeConfigs',
    type: 'confirm',
    message: i18n(`${i18nKey}.mergeConfigsPrompt`, {
      deprecatedConfigPath:
        getConfigPath(configPath, false, true) ||
        DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      globalConfigPath,
    }),
  });

  if (!shouldMergeConfigs) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  // @ts-ignore TODO
  const deprecatedConfig = getAndLoadConfigIfNeeded(args, false, true);
  const globalConfig = getConfig(true);
  // @ts-ignore TODO
  mergeExistingConfigs(globalConfig, deprecatedConfig);
  logger.log(
    i18n(`${i18nKey}.mergeSuccess`, {
      globalConfigPath,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

export async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  const { config: configPath } = args;

  if (!configFileExists(true)) {
    await handleMigration(args, configPath);
  } else if (configFileExists(true) && configFileExists(false, configPath)) {
    await handleMerge(args, configPath);
  } else if (configFileExists(true) && !configFileExists(false, configPath)) {
    logger.log(
      i18n(`${i18nKey}.migrationAlreadyCompleted`, {
        globalConfigPath,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

export function builder(yargs: Argv): Argv<ConfigMigrateArgs> {
  addConfigOptions(yargs);

  yargs.example([
    [
      '$0 config migrate',
      i18n(`${i18nKey}.examples.default`, {
        deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
        globalConfigPath,
      }),
    ],
    [
      '$0 config migrate --config=/path/to/config.yml',
      i18n(`${i18nKey}.examples.configFlag`, { globalConfigPath }),
    ],
  ]);

  return yargs as Argv<ConfigMigrateArgs>;
}
