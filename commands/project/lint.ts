import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getProjectPackageJsonLocations,
  installPackages,
} from '../../lib/dependencyManagement.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import SpinniesManager from '../../lib/ui/SpinniesManager.js';
import {
  areAllLintPackagesInstalled,
  getMissingLintPackages,
  lintPackages,
  displayLintResults,
  hasEslintConfig,
  hasDeprecatedEslintConfig,
  getDeprecatedEslintConfigFiles,
  createEslintConfig,
  REQUIRED_PACKAGES_AND_MIN_VERSIONS,
} from '../../lib/projects/uieLinting.js';

const command = 'lint';
const describe = commands.project.lint.help.describe;

export type ProjectLintArgs = CommonArgs & {
  installMissingDeps?: boolean;
};

async function handler(
  args: ArgumentsCamelCase<ProjectLintArgs>
): Promise<void> {
  const { derivedAccountId, installMissingDeps } = args;
  try {
    trackCommandUsage('project-lint', undefined, derivedAccountId);

    const projectConfig = await getProjectConfig();
    if (!projectConfig || !projectConfig.projectDir) {
      uiLogger.error(commands.project.lint.noProjectConfig);
      return process.exit(EXIT_CODES.ERROR);
    }

    SpinniesManager.init({ succeedColor: 'white' });
    SpinniesManager.add('lintCheck', {
      text: commands.project.lint.loading.checking,
    });

    const lintLocations = await getProjectPackageJsonLocations();
    const locationsReadyToLint: string[] = [];
    const locationsNeedingPackages = new Map<string, string[]>();

    for (const lintLocation of lintLocations) {
      if (areAllLintPackagesInstalled(lintLocation)) {
        locationsReadyToLint.push(lintLocation);
      } else {
        const { missingPackages } = getMissingLintPackages(lintLocation);

        if (missingPackages.length > 0) {
          locationsNeedingPackages.set(lintLocation, missingPackages);
        }
      }
    }

    SpinniesManager.succeed('lintCheck');

    if (locationsNeedingPackages.size > 0) {
      const locationsArray = Array.from(locationsNeedingPackages.keys());
      const relativeLocations = locationsArray.map(loc =>
        path.relative(projectConfig.projectDir!, loc)
      );

      const allMissingPackages: string[] = [];
      for (const packages of locationsNeedingPackages.values()) {
        allMissingPackages.push(...packages);
      }

      let shouldInstallPackages: boolean;

      if (installMissingDeps !== undefined) {
        shouldInstallPackages = installMissingDeps;
      } else {
        const promptResult = await promptUser([
          {
            name: 'shouldInstallPackages',
            type: 'confirm',
            message: commands.project.lint.installLintPackagesPrompt(
              relativeLocations,
              allMissingPackages
            ),
            default: true,
          },
        ]);
        shouldInstallPackages = promptResult.shouldInstallPackages;
      }

      if (shouldInstallPackages) {
        const packagesToInstall = Object.entries(
          REQUIRED_PACKAGES_AND_MIN_VERSIONS
        ).map(([pkg, version]) => `${pkg}@^${version}`);

        await installPackages({
          packages: packagesToInstall,
          installLocations: locationsArray,
          dev: true,
        });

        // Re-check which locations are now ready
        for (const location of locationsArray) {
          if (areAllLintPackagesInstalled(location)) {
            locationsReadyToLint.push(location);
          }
        }
      } else {
        uiLogger.warn(
          commands.project.lint.skippingDirectoriesWarning(relativeLocations)
        );
      }
    }

    if (locationsReadyToLint.length > 0) {
      // Check for config files and handle deprecated configs
      const deprecatedConfigDetails: { path: string; files: string[] }[] = [];
      const locationsNeedingConfig: string[] = [];

      for (const location of locationsReadyToLint) {
        const hasModernConfig = hasEslintConfig(location);
        const hasDeprecatedConfig = hasDeprecatedEslintConfig(location);

        if (hasDeprecatedConfig) {
          const relativePath = path.relative(
            projectConfig.projectDir!,
            location
          );
          const deprecatedFiles = getDeprecatedEslintConfigFiles(location);
          deprecatedConfigDetails.push({
            path: relativePath,
            files: deprecatedFiles,
          });
        }

        if (!hasModernConfig) {
          locationsNeedingConfig.push(location);
        }
      }

      if (deprecatedConfigDetails.length > 0) {
        uiLogger.log('');
        uiLogger.warn(
          commands.project.lint.deprecatedEslintConfigWarning(
            deprecatedConfigDetails
          )
        );
      }

      if (locationsNeedingConfig.length > 0) {
        const relativeLocations = locationsNeedingConfig.map(loc =>
          path.relative(projectConfig.projectDir!, loc)
        );

        const { shouldCreateConfig } = await promptUser([
          {
            name: 'shouldCreateConfig',
            type: 'confirm',
            message:
              commands.project.lint.createEslintConfigPrompt(relativeLocations),
            default: true,
          },
        ]);

        if (shouldCreateConfig) {
          SpinniesManager.add('lintConfigCreate', {
            text: commands.project.lint.loading.creatingConfig,
          });

          const createdConfigs: string[] = [];
          for (const location of locationsNeedingConfig) {
            const configPath = createEslintConfig(location);
            createdConfigs.push(configPath);
          }

          SpinniesManager.succeed('lintConfigCreate');

          createdConfigs.forEach(configPath => {
            uiLogger.success(
              commands.project.lint.eslintConfigCreated(configPath)
            );
          });
        } else {
          uiLogger.error(commands.project.lint.eslintConfigRequired);
          return process.exit(EXIT_CODES.ERROR);
        }
      }

      SpinniesManager.add('lintRun', {
        text: commands.project.lint.loading.linting,
      });

      const { success, results } = await lintPackages(
        locationsReadyToLint,
        projectConfig.projectDir!
      );

      SpinniesManager.succeed('lintRun');

      displayLintResults(results);

      if (!success) {
        return process.exit(EXIT_CODES.ERROR);
      }
    }
  } catch (e) {
    logError(e);
    return process.exit(EXIT_CODES.ERROR);
  }
}

function projectLintBuilder(yargs: Argv): Argv<ProjectLintArgs> {
  yargs.example([
    ['$0 project lint', commands.project.lint.help.lintProjectExample],
    [
      '$0 project lint --install-missing-deps',
      commands.project.lint.help.lintProjectWithInstallExample,
    ],
    [
      '$0 project lint --install-missing-deps=false',
      commands.project.lint.help.lintProjectWithoutInstallExample,
    ],
  ]);

  yargs.option('install-missing-deps', {
    type: 'boolean',
    describe: commands.project.lint.help.installMissingDeps,
  });

  return yargs as Argv<ProjectLintArgs>;
}

const builder = makeYargsBuilder<ProjectLintArgs>(
  projectLintBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const projectLintCommand: YargsCommandModule<unknown, ProjectLintArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectLintCommand;
