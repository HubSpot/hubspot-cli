import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { commands } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { confirmPrompt } from '../prompts/promptUtils.js';
import { uiLogger } from '../ui/logger.js';
import { getIsInProject, getProjectConfig } from './config.js';
import {
  getProjectArchiveDest,
  restoreSourceFromProjectArchive,
} from './archive.js';
import {
  copyArchivedFilesToSource,
  getFilesOnlyInArchive,
  writeArchiveDiffFile,
} from './archiveDiff.js';

const MAX_LISTED_ARCHIVE_ONLY_FILES = 25;

export type LocalProject = {
  projectName: string;
  projectDir: string;
  srcDir: string;
};

export type ArchivePlan = {
  projectDir: string;
  srcDir: string;
  archiveDest: string;
};

type DownloadDestination = {
  absoluteDestPath: string;
  archivePlan?: ArchivePlan;
};

type ResolveDownloadDestinationOptions = {
  projectName: string;
  dest?: string;
  localProject?: LocalProject;
};

export function getLocalProject(): LocalProject | undefined {
  if (!getIsInProject()) {
    return undefined;
  }
  const { projectConfig, projectDir } = getProjectConfig();
  return {
    projectName: projectConfig.name,
    projectDir,
    srcDir: projectConfig.srcDir,
  };
}

export function resolveDownloadDestination({
  projectName,
  dest,
  localProject,
}: ResolveDownloadDestinationOptions): DownloadDestination {
  if (localProject && !dest && localProject.projectName === projectName) {
    const { projectDir, srcDir } = localProject;
    return {
      absoluteDestPath: projectDir,
      archivePlan: {
        projectDir,
        srcDir,
        archiveDest: getProjectArchiveDest(projectDir),
      },
    };
  }

  const sanitizedProjectName = sanitizeFileName(projectName);
  const absoluteDestPath = dest
    ? path.resolve(getCwd(), dest, sanitizedProjectName)
    : path.resolve(getCwd(), sanitizedProjectName);

  return { absoluteDestPath };
}

export function getDisplayPath(absolutePath: string): string {
  return path.relative(getCwd(), absolutePath) || '.';
}

export function describeArchiveLocation({ archiveDest }: ArchivePlan): string {
  return commands.project.download.archiveLocation(getDisplayPath(archiveDest));
}

function restoreArchivedSource({
  projectDir,
  srcDir,
  archiveDest,
}: ArchivePlan): void {
  try {
    restoreSourceFromProjectArchive(projectDir, srcDir);
    uiLogger.warn(commands.project.download.warnings.sourceRestored);
  } catch (error) {
    debugError(error);
    uiLogger.error(
      commands.project.download.errors.restoreFailed(
        getDisplayPath(archiveDest)
      )
    );
  }
}

function tryWriteArchiveDiffFile(
  archiveDest: string,
  files: string[]
): string | undefined {
  try {
    return writeArchiveDiffFile(archiveDest, files);
  } catch (error) {
    debugError(error);
    return undefined;
  }
}

async function logFilesOnlyInArchive({
  projectDir,
  srcDir,
  archiveDest,
}: ArchivePlan): Promise<string[]> {
  let files: string[];
  try {
    files = await getFilesOnlyInArchive(projectDir, srcDir);
  } catch (error) {
    debugError(error);
    return [];
  }

  if (files.length === 0) {
    return [];
  }

  const diffFilePath = tryWriteArchiveDiffFile(archiveDest, files);

  uiLogger.log('');
  uiLogger.log(
    commands.project.download.logs.filesOnlyInArchive(
      files.slice(0, MAX_LISTED_ARCHIVE_ONLY_FILES),
      Math.max(files.length - MAX_LISTED_ARCHIVE_ONLY_FILES, 0),
      diffFilePath ? getDisplayPath(diffFilePath) : undefined
    )
  );

  return files;
}

type CopyFilesBackOptions = {
  archivePlan: ArchivePlan;
  files: string[];
  keepLocalFiles?: boolean;
  canPrompt: boolean;
};

async function shouldCopyFilesBack({
  files,
  keepLocalFiles,
  canPrompt,
}: Omit<CopyFilesBackOptions, 'archivePlan'>): Promise<boolean> {
  if (keepLocalFiles !== undefined) {
    return keepLocalFiles;
  }
  if (!canPrompt) {
    return false;
  }
  uiLogger.log('');
  return confirmPrompt(
    commands.project.download.prompts.confirmCopyFilesBack(files.length)
  );
}

async function copyFilesBack(options: CopyFilesBackOptions): Promise<void> {
  const { archivePlan, files } = options;
  if (files.length === 0 || !(await shouldCopyFilesBack(options))) {
    return;
  }

  const { projectDir, srcDir } = archivePlan;
  const { copiedCount, failures } = copyArchivedFilesToSource(
    projectDir,
    srcDir,
    files
  );

  failures.forEach(({ error }) => debugError(error));

  if (copiedCount > 0) {
    uiLogger.success(
      commands.project.download.logs.filesCopiedBack(
        copiedCount,
        getDisplayPath(path.join(projectDir, srcDir))
      )
    );
  }
  if (failures.length > 0) {
    uiLogger.warn(
      commands.project.download.warnings.filesNotCopiedBack(failures.length)
    );
  }
}

type HandleArchivedSourceOptions = {
  archivePlan: ArchivePlan;
  keepLocalFiles?: boolean;
  canPrompt: boolean;
};

export async function handleArchivedSource({
  archivePlan,
  keepLocalFiles,
  canPrompt,
}: HandleArchivedSourceOptions): Promise<void> {
  uiLogger.info(
    commands.project.download.logs.sourceContentsArchived(
      describeArchiveLocation(archivePlan)
    )
  );
  const files = await logFilesOnlyInArchive(archivePlan);
  await copyFilesBack({ archivePlan, files, keepLocalFiles, canPrompt });
}

type ExtractBuildOptions = {
  zippedProject: Buffer;
  projectName: string;
  absoluteDestPath: string;
  archivePlan?: ArchivePlan;
};

export async function extractBuild({
  zippedProject,
  projectName,
  absoluteDestPath,
  archivePlan,
}: ExtractBuildOptions): Promise<void> {
  try {
    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectName),
      absoluteDestPath
    );
  } catch (error) {
    if (archivePlan) {
      restoreArchivedSource(archivePlan);
    }
    throw error;
  }
}
