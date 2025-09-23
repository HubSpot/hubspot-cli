import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { migrateApp2025_2 } from '../../lib/app/migrate.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/projects';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiCommandReference } from '../../lib/ui/index.js';
import { commands, lib } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { logInBox } from '../../lib/ui/boxen.js';
import { renderInline } from '../../ui/index.js';
import { getWarningBox } from '../../ui/components/StatusMessageBoxes.js';
import {
  getHasMigratableThemes,
  migrateThemes2025_2,
} from '../../lib/theme/migrate.js';
import { hasFeature } from '../../lib/hasFeature.js';
import { FEATURES } from '../../lib/constants.js';

export type ProjectMigrateArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    platformVersion: string;
    unstable: boolean;
  };

const { v2025_2 } = PLATFORM_VERSIONS;

const command = 'migrate';
const describe = commands.project.migrate.describe;

async function handler(
  args: ArgumentsCamelCase<ProjectMigrateArgs>
): Promise<void> {
  const { platformVersion, unstable } = args;
  const projectConfig = await getProjectConfig();

  if (!projectConfig.projectConfig) {
    uiLogger.error(
      commands.project.migrate.errors.noProjectConfig(
        uiCommandReference('hs app migrate')
      )
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (projectConfig?.projectConfig) {
    if (!process.env.HUBSPOT_ENABLE_INK) {
      await logInBox({
        contents: lib.migrate.projectMigrationWarning,
        options: { title: lib.migrate.projectMigrationWarningTitle },
      });
    } else {
      await renderInline(
        getWarningBox({
          title: lib.migrate.projectMigrationWarningTitle,
          message: lib.migrate.projectMigrationWarning,
        })
      );
    }
  }

  const { derivedAccountId } = args;
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
        return process.exit(EXIT_CODES.ERROR);
      }
      await migrateThemes2025_2(
        derivedAccountId,
        {
          ...args,
          platformVersion: unstable
            ? PLATFORM_VERSIONS.unstable
            : platformVersion,
        },
        migratableThemesCount,
        projectConfig
      );
    } else {
      await migrateApp2025_2(
        derivedAccountId,
        {
          ...args,
          name: projectConfig?.projectConfig?.name,
          platformVersion: unstable
            ? PLATFORM_VERSIONS.unstable
            : platformVersion,
        },
        projectConfig
      );
    }
  } catch (error) {
    logError(error);
    return process.exit(EXIT_CODES.ERROR);
  }
  return process.exit(EXIT_CODES.SUCCESS);
}

function projectMigrateBuilder(yargs: Argv): Argv<ProjectMigrateArgs> {
  yargs
    .option('platform-version', {
      type: 'string',
      choices: [v2025_2],
      default: v2025_2,
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
  handler,
  builder,
};

export default migrateCommand;
