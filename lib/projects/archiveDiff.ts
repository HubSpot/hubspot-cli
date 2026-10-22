import fs from 'fs';
import path from 'path';
import {
  ARCHIVE_DIR_NAME,
  ROOT_SRC_DIR,
  getProjectArchiveDest,
} from './archive.js';

const DIFF_FILE_NAME = 'diff.json';
const IGNORED_DIR_NAMES = new Set(['node_modules', 'dist', '.git']);

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

type ListFilesOptions = {
  rootDir: string;
  currentDir?: string;
  ignoredRootEntry?: string;
};

function isIgnoredDir(
  entry: fs.Dirent,
  { rootDir, currentDir, ignoredRootEntry }: ListFilesOptions
): boolean {
  const isIgnoredRootEntry =
    currentDir === rootDir && entry.name === ignoredRootEntry;
  return isIgnoredRootEntry || IGNORED_DIR_NAMES.has(entry.name);
}

async function listEntryFiles(
  options: ListFilesOptions,
  entry: fs.Dirent
): Promise<string[]> {
  const { rootDir, currentDir = rootDir } = options;
  const entryPath = path.join(currentDir, entry.name);

  if (entry.isDirectory() && !isIgnoredDir(entry, { ...options, currentDir })) {
    return listFiles({ ...options, currentDir: entryPath });
  }
  if (entry.isFile()) {
    return [toPosixPath(path.relative(rootDir, entryPath))];
  }
  return [];
}

async function listFiles(options: ListFilesOptions): Promise<string[]> {
  const { rootDir, currentDir = rootDir } = options;
  if (!fs.existsSync(currentDir)) {
    return [];
  }
  const entries = await fs.promises.readdir(currentDir, {
    withFileTypes: true,
  });
  const nestedFiles = await Promise.all(
    entries.map(entry => listEntryFiles({ ...options, currentDir }, entry))
  );
  return nestedFiles.flat();
}

export async function getFilesOnlyInArchive(
  projectDir: string,
  srcDir: string
): Promise<string[]> {
  const archiveFiles = await listFiles({
    rootDir: getProjectArchiveDest(projectDir),
  });
  const downloadedFiles = new Set(
    await listFiles({
      rootDir: path.join(projectDir, srcDir),
      ignoredRootEntry: srcDir === ROOT_SRC_DIR ? ARCHIVE_DIR_NAME : undefined,
    })
  );

  return archiveFiles.filter(file => !downloadedFiles.has(file)).sort();
}

export function writeArchiveDiffFile(
  archiveDest: string,
  files: string[]
): string {
  const diffFilePath = path.join(archiveDest, DIFF_FILE_NAME);
  fs.writeFileSync(diffFilePath, `${JSON.stringify(files, null, 2)}\n`);
  return diffFilePath;
}

type FailedFileCopy = {
  file: string;
  error: unknown;
};

type CopyArchivedFilesResult = {
  copiedCount: number;
  failures: FailedFileCopy[];
};

function copyArchivedFile(
  archiveDest: string,
  srcPath: string,
  file: string
): void {
  const destination = path.join(srcPath, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(
    path.join(archiveDest, file),
    destination,
    fs.constants.COPYFILE_EXCL
  );
}

export function copyArchivedFilesToSource(
  projectDir: string,
  srcDir: string,
  files: string[]
): CopyArchivedFilesResult {
  const archiveDest = getProjectArchiveDest(projectDir);
  const srcPath = path.join(projectDir, srcDir);
  const failures: FailedFileCopy[] = [];

  files.forEach(file => {
    try {
      copyArchivedFile(archiveDest, srcPath, file);
    } catch (error) {
      failures.push({ file, error });
    }
  });

  return { copiedCount: files.length - failures.length, failures };
}
