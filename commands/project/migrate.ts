import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { migrateApp } from '../../lib/app/migrate.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiCommandReference } from '../../lib/ui/index.js';
import { commands, lib } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { renderInline } from '../../ui/render.js';
import { getWarningBox } from '../../ui/components/StatusMessageBoxes.js';
import {
  getHasMigratableThemes,
  migrateThemesV2,
} from '../../lib/theme/migrate.js';
import { hasFeature } from '../../lib/hasFeature.js';
import { FEATURES } from '../../lib/constants.js';
import { trackCommandMetadataUsage } from '../../lib/usageTracking.js';

export type ProjectMigrateArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    platformVersion: string;
    unstable: boolean;
  };

const { v2025_2, v2026_03_BETA, v2026_03 } = PLATFORM_VERSIONS;

const command = 'migrate';
const describe = commands.project.migrate.describe;

async function handler(
  args: ArgumentsCamelCase<ProjectMigrateArgs>
): Promise<void> {
  const { platformVersion, unstable, derivedAccountId, exit } = args;
  const projectConfig = await getProjectConfig();

  if (!projectConfig.projectConfig) {
    uiLogger.error(
      commands.project.migrate.errors.noProjectConfig(
        uiCommandReference('hs app migrate')
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  if (projectConfig?.projectConfig) {
    await renderInline(
      getWarningBox({
        title: lib.migrate.projectMigrationWarningTitle(platformVersion),
        message: lib.migrate.projectMigrationWarning(platformVersion),
      })
    );
  }

  try {
    const { hasMigratableThemes, migratableThemesCount } =
      await getHasMigratableThemes(projectConfig);

    if (hasMigratableThemes) {
      const hasThemeMigrationAccess = await hasFeature(
        derivedAccountId,
        FEATURES.THEME_MIGRATION_2025_2
      );

      if (!hasThemeMigrationAccess) {
        uiLogger.error(
          commands.project.migrate.errors.noThemeMigrationAccess(
            derivedAccountId
          )
        );
        return exit(EXIT_CODES.ERROR);
      }
      await migrateThemesV2(
        derivedAccountId,
        {
          ...args,
          platformVersion: unstable
            ? PLATFORM_VERSIONS.UNSTABLE
            : platformVersion,
        },
        migratableThemesCount,
        projectConfig
      );
    } else {
      await migrateApp(
        derivedAccountId,
        {
          ...args,
          name: projectConfig?.projectConfig?.name,
          platformVersion: unstable
            ? PLATFORM_VERSIONS.UNSTABLE
            : platformVersion,
        },
        projectConfig
      );
    }
  } catch (error) {
    await trackCommandMetadataUsage(
      'project-migrate',
      { successful: false },
      derivedAccountId
    );
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }
  await trackCommandMetadataUsage(
    'project-migrate',
    { successful: true },
    derivedAccountId
  );
  return exit(EXIT_CODES.SUCCESS);
}

function projectMigrateBuilder(yargs: Argv): Argv<ProjectMigrateArgs> {
  yargs
    .option('platform-version', {
      type: 'string',
      choices: [v2025_2, v2026_03_BETA, v2026_03],
      default: v2026_03,
    })
    .option('unstable', {
      type: 'boolean',
      default: false,
      hidden: true,
    });

  return yargs as Argv<ProjectMigrateArgs>;
}

const builder = makeYargsBuilder<ProjectMigrateArgs>(
  projectMigrateBuilder,
  command,
  commands.project.migrate.describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const migrateCommand: YargsCommandModule<unknown, ProjectMigrateArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('project-migrate', handler),
  builder,
};

export default migrateCommand;
