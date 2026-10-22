import fs from 'fs';
import path from 'path';
import { lib } from '../../lang/en.js';

export const ARCHIVE_DIR_NAME = 'archive';
export const ROOT_SRC_DIR = '.';
const ROOT_ENTRIES_KEPT_IN_PLACE = new Set([
  '.git',
  'node_modules',
  'dist',
  'hsproject.json',
]);

export function getArchiveDest(projectDir: string, srcDir: string): string {
  if (srcDir === ROOT_SRC_DIR) {
    return path.join(
      path.dirname(projectDir),
      `${path.basename(projectDir)}-${ARCHIVE_DIR_NAME}`
    );
  }
  return path.join(projectDir, ARCHIVE_DIR_NAME);
}

export function archiveDestExists(archiveDest: string): boolean {
  return fs.existsSync(archiveDest);
}

export function archiveProjectSource(
  projectDir: string,
  srcDir: string
): string {
  const archiveDest = getArchiveDest(projectDir, srcDir);
  fs.renameSync(path.join(projectDir, srcDir), archiveDest);
  return archiveDest;
}

export function getProjectArchiveDest(projectDir: string): string {
  return path.join(projectDir, ARCHIVE_DIR_NAME);
}

function assertSrcDirOutsideArchive(projectDir: string, srcDir: string): void {
  const archiveDest = path.resolve(getProjectArchiveDest(projectDir));
  const srcPath = path.resolve(projectDir, srcDir);
  const isInsideArchive =
    srcPath === archiveDest || srcPath.startsWith(archiveDest + path.sep);

  if (isInsideArchive) {
    throw new Error(lib.projects.archive.errors.srcDirInsideArchive(srcDir));
  }
}

function assertArchiveExists(archiveDest: string): void {
  if (!fs.existsSync(archiveDest)) {
    throw new Error(lib.projects.archive.errors.archiveNotFound(archiveDest));
  }
}

function getMovableRootEntries(projectDir: string): string[] {
  return fs
    .readdirSync(projectDir)
    .filter(
      name => name !== ARCHIVE_DIR_NAME && !ROOT_ENTRIES_KEPT_IN_PLACE.has(name)
    );
}

function moveEntries(
  names: string[],
  fromDir: string,
  toDir: string
): string[] {
  const moved: string[] = [];
  try {
    names.forEach(name => {
      fs.renameSync(path.join(fromDir, name), path.join(toDir, name));
      moved.push(name);
    });
  } catch (error) {
    moved.forEach(name => {
      fs.renameSync(path.join(toDir, name), path.join(fromDir, name));
    });
    throw error;
  }
  return moved;
}

function archiveRootEntries(projectDir: string, archiveDest: string): void {
  fs.mkdirSync(archiveDest);
  try {
    moveEntries(getMovableRootEntries(projectDir), projectDir, archiveDest);
  } catch (error) {
    fs.rmdirSync(archiveDest);
    throw error;
  }
}

export function moveSourceToProjectArchive(
  projectDir: string,
  srcDir: string
): string {
  assertSrcDirOutsideArchive(projectDir, srcDir);
  const archiveDest = getProjectArchiveDest(projectDir);

  if (srcDir === ROOT_SRC_DIR) {
    archiveRootEntries(projectDir, archiveDest);
    return archiveDest;
  }

  fs.renameSync(path.join(projectDir, srcDir), archiveDest);
  return archiveDest;
}

function restoreRootEntries(projectDir: string, archiveDest: string): void {
  getMovableRootEntries(projectDir).forEach(name => {
    fs.rmSync(path.join(projectDir, name), { recursive: true, force: true });
  });
  fs.readdirSync(archiveDest).forEach(name => {
    fs.cpSync(path.join(archiveDest, name), path.join(projectDir, name), {
      recursive: true,
    });
  });
}

export function restoreSourceFromProjectArchive(
  projectDir: string,
  srcDir: string
): void {
  const archiveDest = getProjectArchiveDest(projectDir);
  assertArchiveExists(archiveDest);
  assertSrcDirOutsideArchive(projectDir, srcDir);

  if (srcDir === ROOT_SRC_DIR) {
    restoreRootEntries(projectDir, archiveDest);
    return;
  }

  const srcPath = path.join(projectDir, srcDir);
  fs.rmSync(srcPath, { recursive: true, force: true });
  fs.cpSync(archiveDest, srcPath, { recursive: true });
}
