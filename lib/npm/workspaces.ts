import { minimatch } from 'minimatch';
import path from 'path';
import {
  safeGetPackageJsonCached,
  findAllPackageJsonFilesInProjectCached,
} from './packageJson.js';

/**
 * Checks if a package directory matches any of the workspace glob patterns.
 *
 * @param directory - The absolute path to the package directory to check
 * @param workspaceRoot - The absolute path to the workspace root directory
 * @param workspaces - Array of glob patterns defining workspace locations (e.g., ['packages/*', 'apps/*'])
 * @returns True if the directory matches any workspace pattern, false otherwise
 */
const isPackageLocationInWorkspaces = (
  directory: string,
  workspaceRoot: string,
  workspaces: string[]
): boolean => {
  const relativePath = path.relative(workspaceRoot, directory);
  return workspaces.some(workspace => minimatch(relativePath, workspace));
};

/**
 * Finds the npm workspace root directory that contains the given package location, with caching.
 *
 * Searches through all package.json files in the project to find one that defines
 * workspaces (via the "workspaces" field) and includes the specified directory
 * within those workspace patterns.
 *
 * @param targetPackageDirectory - The absolute path to the package directory to find the workspace root for
 * @returns The absolute path to the workspace root directory, or null if the package is not part of any workspace
 *
 */
export const getNpmWorkspaceDirectoryForPackageAtLocationCached = async (
  targetPackageDirectory: string
): Promise<string | null> => {
  const allPackageJsonFilesInProject =
    await findAllPackageJsonFilesInProjectCached();

  if (allPackageJsonFilesInProject.length === 0) {
    return null;
  }

  for (const currentPackageJsonFile of allPackageJsonFilesInProject) {
    const packageJson = safeGetPackageJsonCached(currentPackageJsonFile);
    const workspaces = packageJson?.workspaces;
    if (!Array.isArray(workspaces) || workspaces.length === 0) {
      // If the package.json file does not define any workspaces, skip it, since
      // it cannot be an npm workspace root.
      continue;
    }

    // We found a package.json file that defines workspaces, so we can now check if the given
    // directory is part of any of the workspace patterns.
    const currentPackageDirectory = path.dirname(currentPackageJsonFile);
    if (
      isPackageLocationInWorkspaces(
        targetPackageDirectory,
        currentPackageDirectory,
        workspaces
      )
    ) {
      return currentPackageDirectory;
    }
  }
  return null;
};
