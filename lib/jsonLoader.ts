// NOTE: Can be switched back to standard import with min node version 23
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Generic JSON loader that works in both test (lib/) and production (dist/lib/) environments.
 * Automatically resolves paths relative to the caller's location.
 *
 * @param importMetaUrl - Pass import.meta.url from the calling file
 * @param relativePath - Path to JSON file relative to the caller (e.g., '../package.json', './fixtures/data.json')
 * @returns The loaded JSON object
 */
export function loadJson<T = unknown>(
  importMetaUrl: string,
  relativePath: string
): T {
  const callerDir = path.dirname(fileURLToPath(importMetaUrl));
  const resolvedPath = path.resolve(callerDir, relativePath);

  // If the resolved path exists, use it directly
  if (existsSync(resolvedPath)) {
    return createRequire(importMetaUrl)(resolvedPath);
  }

  // If not found, try adjusting for dist/ directory
  // This handles the case where we're in dist/lib/ but the JSON is at project root
  const pathParts = resolvedPath.split(path.sep);
  const distIndex = pathParts.indexOf('dist');

  if (distIndex !== -1) {
    // Remove 'dist' from the path and try again
    pathParts.splice(distIndex, 1);
    const adjustedPath = pathParts.join(path.sep);

    if (existsSync(adjustedPath)) {
      return createRequire(importMetaUrl)(adjustedPath);
    }
  }

  throw new Error(
    `JSON file not found: ${relativePath} (resolved to ${resolvedPath})`
  );
}

/**
 * Helper to find package.json by walking up the directory tree.
 * Works regardless of whether we're in lib/ or dist/lib/.
 */
function findPackageJsonPath(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (existsSync(pkgPath)) {
      return pkgPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root without finding package.json (e.g., in test environments)
      return null;
    }
    currentDir = parentDir;
  }
}

// Load package.json once when this module is imported for convenience
// In test environments where this can't be found, tests should mock this module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = findPackageJsonPath(__dirname);
export const pkg = pkgPath
  ? (createRequire(import.meta.url)(pkgPath) as {
      name: string;
      version: string;
      [key: string]: unknown;
    })
  : ({ name: 'unknown', version: 'unknown' } as {
      name: string;
      version: string;
      [key: string]: unknown;
    });
