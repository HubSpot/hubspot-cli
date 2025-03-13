import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  configFileExists,
  getAndLoadConfigIfNeeded,
  getConfigPath,
} from '@hubspot/local-dev-lib/config';
import { getCwd } from '@hubspot/local-dev-lib/path';
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  HUBSPOT_CONFIGURATION_FOLDER,
  HUBSPOT_CONFIGURATION_FILE,
} from '@hubspot/local-dev-lib/constants/config';
import { logger } from '@hubspot/local-dev-lib/logger';

import { migrateConfig } from '../../lib/configMigrate';
import { promptUser } from '../../lib/prompts/promptUtils';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

const i18nKey = 'commands.config.subcommands.migrate';
const centralizedConfigPath = `${getCwd()}/${HUBSPOT_CONFIGURATION_FOLDER}/${HUBSPOT_CONFIGURATION_FILE}`;

export const describe = i18n(`${i18nKey}.describe`, {
  deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  centralizedConfigPath,
});
export const command = 'migrate';

type ConfigMigrateArgs = CommonArgs & ConfigArgs;

export async function handler(
  args: ArgumentsCamelCase<ConfigMigrateArgs>
): Promise<void> {
  // User hasn't migrated; need to create a new centralized config file
  if (!configFileExists(true)) {
    const { shouldMigrateConfig } = await promptUser({
      name: 'shouldMigrateConfig',
      type: 'confirm',
      message: i18n(`${i18nKey}.migrateConfigPrompt`, {
        deprecatedConfigPath: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
        centralizedConfigPath,
      }),
    });

    if (!shouldMigrateConfig) {
      process.exit(EXIT_CODES.SUCCESS);
    }

    // @ts-ignore TODO
    const config = getAndLoadConfigIfNeeded(args);
    // @ts-ignore TODO
    migrateConfig(config);
    logger.log(
      i18n(`${i18nKey}.success`, {
        configPath: getConfigPath('', true)!,
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
        centralizedConfigPath,
      }),
    ],
    [
      '$0 config migrate --config=/path/to/config.yml',
      i18n(`${i18nKey}.examples.configFlag`, { centralizedConfigPath }),
    ],
  ]);

  return yargs as Argv<ConfigMigrateArgs>;
}
