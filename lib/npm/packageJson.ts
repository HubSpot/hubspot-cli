import path from 'node:path';
import fs from 'node:fs';

import { walk } from '@hubspot/local-dev-lib/fs';

import type { PackageJson } from '../../types/PackageJson.js';

import { getProjectConfig } from '../projects/config.js';

export interface PackageJsonWithMetadata {
  packageJsonFilename: string;
  packageRootDirectory: string;
  packageJson: PackageJson;
}

const packageJsonCache = new Map<
  string,
  PackageJsonWithMetadata | null | undefined
>();

const packageJsonFilesCache = new Map<string, string[]>();

const safeReadTextFile = (filePath: string): string | null => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
};

const safeReadJsonFile = <TJsonData = unknown>(
  filePath: string
): TJsonData | null => {
  const text = safeReadTextFile(filePath);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text) as TJsonData;
  } catch {
    return null;
  }
};

const safeReadPackageJsonWithMetadataUncached = (
  packageJsonPath: string
): PackageJsonWithMetadata | null => {
  const manifest = safeReadJsonFile<PackageJson>(packageJsonPath);
  if (!manifest) {
    return null;
  }

  return {
    packageJsonFilename: packageJsonPath,
    packageRootDirectory: path.dirname(packageJsonPath),
    packageJson: manifest,
  };
};

const safeReadPackageJsonWithMetadataCached = (
  packageJsonPath: string
): PackageJsonWithMetadata | null => {
  const maybeCachedPackageJsonWithMetadata =
    packageJsonCache.get(packageJsonPath);
  if (maybeCachedPackageJsonWithMetadata !== undefined) {
    return maybeCachedPackageJsonWithMetadata;
  }

  // If not cached, read the package.json file and cache the result.
  const packageJsonWithMetadata =
    safeReadPackageJsonWithMetadataUncached(packageJsonPath);
  packageJsonCache.set(packageJsonPath, packageJsonWithMetadata);

  return packageJsonWithMetadata;
};

/**
 * Reads and parses a package.json file, with caching.
 *
 * @param packageJsonPath - Absolute path to the package.json file
 * @returns The parsed PackageJson object, or null if the file doesn't exist or is invalid
 */
export const safeGetPackageJsonCached = (
  packageJsonPath: string
): PackageJson | null => {
  const maybePackageJsonWithMetadata =
    safeReadPackageJsonWithMetadataCached(packageJsonPath);
  return maybePackageJsonWithMetadata?.packageJson || null;
};

/**
 * Clears all cached package.json data and file paths.
 * Use this when package.json files may have been modified externally.
 */
export const clearPackageJsonCache = () => {
  packageJsonCache.clear();
  packageJsonFilesCache.clear();
};

const findAllPackageJsonFilesInDirectoryUncached = async (
  directory: string
): Promise<string[]> => {
  const packageJsonFiles = (await walk(directory)).filter(
    file =>
      file.includes('package.json') &&
      !file.includes('node_modules') &&
      !file.includes('.vite')
  );
  return packageJsonFiles;
};

/**
 * Finds all package.json files in a directory recursively, with caching.
 * Excludes files in node_modules and .vite directories.
 *
 * @param directory - Root directory to search from
 * @returns Array of absolute paths to package.json files
 */
const findAllPackageJsonFilesInDirectoryCached = async (
  directory: string
): Promise<string[]> => {
  const maybeCachedPackageJsonFiles = packageJsonFilesCache.get(directory);
  if (maybeCachedPackageJsonFiles) {
    return maybeCachedPackageJsonFiles;
  }

  // If not cached, find all package.json files in the directory and cache the result.
  const packageJsonFiles =
    await findAllPackageJsonFilesInDirectoryUncached(directory);
  packageJsonFilesCache.set(directory, packageJsonFiles);

  return packageJsonFiles;
};

/**
 * Finds all package.json files in the project, with caching.
 *
 * @returns Array of absolute paths to package.json files in the project
 */
export async function findAllPackageJsonFilesInProjectCached(): Promise<
  string[]
> {
  const projectConfig = await getProjectConfig();
  const { projectDir } = projectConfig;
  if (!projectDir) {
    return [];
  }

  const packageJsonFiles =
    await findAllPackageJsonFilesInDirectoryCached(projectDir);

  return packageJsonFiles;
}
