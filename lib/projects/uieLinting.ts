import fs from 'fs';
import path from 'path';
import util from 'util';
import semver from 'semver';
import { exec as execAsync } from 'node:child_process';
import { fetchRepoFile } from '@hubspot/local-dev-lib/api/github';
import {
  getProjectPackageJsonLocations,
  isPackageInstalled,
} from '../dependencyManagement.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import {
  clearPackageJsonCache,
  safeGetPackageJsonCached,
} from '../npm/packageJson.js';
import { debugError } from '../errorHandlers/index.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} from '../constants.js';

export const REQUIRED_PACKAGES_AND_MIN_VERSIONS = {
  eslint: '9.0.0',
  '@eslint/js': '9.0.0',
  'typescript-eslint': '8.46.4',
  '@hubspot/eslint-config-ui-extensions': '1.0.0',
  'eslint-config-prettier': '10.0.0',
  'eslint-plugin-react': '7.0.0',
  'eslint-plugin-react-hooks': '7.0.0',
  'eslint-plugin-unused-imports': '4.0.0',
  prettier: '3.0.0',
  jiti: '2.6.1',
} as const;

const UIE_ESLINT_CONFIG_PATH_IN_REPO =
  'components/cards/src/app/cards/eslint.config.js';

const ESLINT_CONFIG_FILES = [
  'eslint.config.mts',
  'eslint.config.ts',
  'eslint.config.cts',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
] as const;

const DEPRECATED_ESLINT_CONFIG_FILES = [
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  '.eslintrc',
] as const;

export const LINT_SCRIPTS = {
  lint: 'eslint .',
  'lint:fix': 'eslint . --fix',
} as const;

function getPackageVersionFromPackageJson(
  directory: string,
  packageName: string
): string | null {
  const packageJsonPath = path.join(directory, 'package.json');
  const packageJson = safeGetPackageJsonCached(packageJsonPath);
  if (!packageJson) {
    return null;
  }

  const version =
    packageJson.dependencies?.[packageName] ||
    packageJson.devDependencies?.[packageName];

  return version || null;
}

function isPackageVersionValid(
  directory: string,
  packageName: string
): boolean {
  const versionRange = getPackageVersionFromPackageJson(directory, packageName);
  if (!versionRange) {
    return false;
  }

  const minimumVersion =
    REQUIRED_PACKAGES_AND_MIN_VERSIONS[
      packageName as keyof typeof REQUIRED_PACKAGES_AND_MIN_VERSIONS
    ];
  if (!minimumVersion) {
    // If no minimum version specified, any version is valid
    return true;
  }

  try {
    // Check if the version range satisfies the minimum version
    // For ranges like ^9.0.0, ~8.5.0, >=9.0.0, etc.
    const minVersionSatisfied = semver.satisfies(minimumVersion, versionRange, {
      includePrerelease: true,
    });

    const coercedVersion = semver.minVersion(versionRange);
    if (coercedVersion) {
      return semver.gte(coercedVersion, minimumVersion);
    }

    return minVersionSatisfied;
  } catch (error) {
    return false;
  }
}

export function isEslintInstalled(directory: string): boolean {
  return isPackageInstalled(directory, 'eslint');
}

export function areAllLintPackagesInstalled(directory: string): boolean {
  return Object.keys(REQUIRED_PACKAGES_AND_MIN_VERSIONS).every(pkg => {
    const installed = isPackageInstalled(directory, pkg);
    const validVersion = isPackageVersionValid(directory, pkg);
    return installed && validVersion;
  });
}

export function getMissingLintPackages(directory: string): {
  missingPackages: string[];
} {
  const missingPackages: string[] = [];

  for (const packageName of Object.keys(REQUIRED_PACKAGES_AND_MIN_VERSIONS)) {
    const isInstalled = isPackageInstalled(directory, packageName);
    const isValidVersion = isPackageVersionValid(directory, packageName);

    if (!isInstalled || !isValidVersion) {
      missingPackages.push(packageName);
    }
  }

  return { missingPackages };
}

export function hasEslintConfig(directory: string): boolean {
  return ESLINT_CONFIG_FILES.some(configFile => {
    const configPath = path.join(directory, configFile);
    return fs.existsSync(configPath);
  });
}

export function hasDeprecatedEslintConfig(directory: string): boolean {
  return DEPRECATED_ESLINT_CONFIG_FILES.some(configFile => {
    const configPath = path.join(directory, configFile);
    return fs.existsSync(configPath);
  });
}

export function getDeprecatedEslintConfigFiles(directory: string): string[] {
  return DEPRECATED_ESLINT_CONFIG_FILES.filter(configFile => {
    const configPath = path.join(directory, configFile);
    return fs.existsSync(configPath);
  });
}

function repoFileDataToString(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }
  return String(data);
}

export async function createEslintConfig(
  directory: string,
  platformVersion?: string | null
): Promise<string> {
  const versionForRemote =
    platformVersion && !isLegacyProject(platformVersion)
      ? platformVersion
      : null;

  if (versionForRemote === null) {
    const message =
      commands.project.lint.createEslintConfigRequiresV2Platform(
        platformVersion
      );
    uiLogger.error(message);
    throw new Error(message);
  }

  let fetchedContent: string | null = null;
  try {
    const { data } = await fetchRepoFile(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
      `${versionForRemote}/${UIE_ESLINT_CONFIG_PATH_IN_REPO}`,
      DEFAULT_PROJECT_TEMPLATE_BRANCH
    );
    const content = repoFileDataToString(data);
    if (content.trim().length > 0) {
      fetchedContent = content;
    }
  } catch (error) {
    debugError(error);
  }

  if (fetchedContent === null) {
    const message =
      commands.project.lint.failedToFetchRemoteEslintConfig(versionForRemote);
    uiLogger.error(message);
    throw new Error(message);
  }

  const configPath = path.join(directory, 'eslint.config.js');
  try {
    fs.writeFileSync(configPath, fetchedContent, 'utf-8');
    return path.relative(process.cwd(), configPath);
  } catch (error) {
    uiLogger.error(
      commands.project.lint.failedToCreateEslintConfig(configPath)
    );
    throw error;
  }
}

export async function lintPackagesInDirectory(
  directory: string,
  projectDir?: string
): Promise<{ success: boolean; output: string }> {
  const displayPath = projectDir
    ? path.relative(projectDir, directory)
    : directory;

  const exec = util.promisify(execAsync);
  const lintCommand = 'npx eslint . --color';

  try {
    const { stdout, stderr } = await exec(lintCommand, {
      cwd: directory,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });

    let output = `\n${displayPath}:\n`;
    if (stdout && stdout.trim()) {
      output += stdout;
    } else {
      output += '  No linting issues found.\n';
    }
    if (stderr && stderr.trim()) {
      output += stderr;
    }

    return { success: true, output };
  } catch (error: unknown) {
    // ESLint returns exit code 1 when there are linting errors
    // but still provides useful output in stdout/stderr
    let output = `\n${displayPath}:\n`;
    if (error && typeof error === 'object' && 'stdout' in error) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        code?: number;
      };
      if (execError.stdout) {
        output += execError.stdout;
      }
      if (execError.stderr) {
        output += execError.stderr;
      }
    }
    return { success: false, output };
  }
}

export async function lintPackages(
  lintLocations?: string[],
  projectDir?: string
): Promise<{
  success: boolean;
  results: Array<{ location: string; success: boolean; output: string }>;
}> {
  const locations = lintLocations || (await getProjectPackageJsonLocations());
  const results: { location: string; success: boolean; output: string }[] = [];

  for (const location of locations) {
    const result = await lintPackagesInDirectory(location, projectDir);
    const displayPath = projectDir
      ? path.relative(projectDir, location)
      : location;
    results.push({ location: displayPath, ...result });
  }

  const failedLocations = results.filter(r => !r.success);
  return {
    success: failedLocations.length === 0,
    results,
  };
}

export function displayLintResults(
  results: Array<{
    location: string;
    success: boolean;
    output: string;
  }>
): void {
  // Display all output
  results.forEach(r => {
    uiLogger.log(r.output);
  });

  // Summary
  const failedLocations = results.filter(r => !r.success);
  const passedLocations = results.filter(r => r.success);

  uiLogger.log('\n' + '='.repeat(50));

  if (passedLocations.length > 0) {
    uiLogger.success(
      `Linting passed in ${passedLocations.length} ${passedLocations.length === 1 ? 'directory' : 'directories'}:`
    );
    passedLocations.forEach(r => {
      uiLogger.log(`  ✓ ${r.location}`);
    });
  }

  if (failedLocations.length > 0) {
    if (passedLocations.length > 0) {
      uiLogger.log('');
    }
    uiLogger.error(
      `Linting failed in ${failedLocations.length} ${failedLocations.length === 1 ? 'directory' : 'directories'}:`
    );
    failedLocations.forEach(r => {
      uiLogger.log(`  ✗ ${r.location}`);
    });
  }
}

export function getMissingLintScripts(directory: string): string[] {
  const packageJsonPath = path.join(directory, 'package.json');
  const packageJson = safeGetPackageJsonCached(packageJsonPath);
  if (!packageJson) {
    return [];
  }

  return Object.keys(LINT_SCRIPTS).filter(
    scriptName => !packageJson.scripts?.[scriptName]
  );
}

export function addLintScriptsToPackageJson(directory: string): {
  added: string[];
  relativePath: string;
} {
  const packageJsonPath = path.join(directory, 'package.json');

  try {
    const rawContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(rawContent);

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    const added: string[] = [];
    for (const [scriptName, scriptValue] of Object.entries(LINT_SCRIPTS)) {
      if (!packageJson.scripts[scriptName]) {
        packageJson.scripts[scriptName] = scriptValue;
        added.push(scriptName);
      }
    }

    if (added.length > 0) {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n',
        'utf-8'
      );
      clearPackageJsonCache();
    }

    return {
      added,
      relativePath: path.relative(process.cwd(), packageJsonPath),
    };
  } catch {
    uiLogger.warn(
      commands.project.lint.failedToAddLintScripts(packageJsonPath)
    );
    return {
      added: [],
      relativePath: path.relative(process.cwd(), packageJsonPath),
    };
  }
}
