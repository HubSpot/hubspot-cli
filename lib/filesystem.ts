import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { FOLDER_DOT_EXTENSIONS } from '@hubspot/local-dev-lib/constants/extensions';

export function resolveLocalPath(filepath?: string): string {
  return filepath && typeof filepath === 'string'
    ? path.resolve(getCwd(), filepath)
    : // Use CWD if optional filepath is not passed.
      getCwd();
}

/**
 * Returns true if childPath is parentDirectory itself or a descendant of it.
 * Compares resolved paths segment by segment, so sibling directories with a
 * shared name prefix (foo-backup vs. foo) are not treated as descendants.
 */
export function isPathInsideDirectory(
  childPath: string,
  parentDirectory: string
): boolean {
  const relativePath = path.relative(
    path.resolve(parentDirectory),
    path.resolve(childPath)
  );
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

export function isPathFolder(path: string): boolean {
  const splitPath = path.split('/');
  const fileOrFolderName = splitPath[splitPath.length - 1];
  const splitName = fileOrFolderName.split('.');

  if (
    splitName.length > 1 &&
    FOLDER_DOT_EXTENSIONS.indexOf(splitName[1]) === -1
  ) {
    return false;
  }

  return true;
}
