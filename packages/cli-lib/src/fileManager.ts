import { FileManagerFile, FileManagerFolder } from './types';
import fs from 'fs-extra';
import path from 'path';

const {
  uploadFile,
  fetchStat,
  fetchFiles,
  fetchFolders,
} = require('./api/fileManager');
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { createIgnoreFilter } = require('./ignoreRules');
const http = require('./http');
const escapeRegExp = require('./lib/escapeRegExp');
const {
  getCwd,
  convertToUnixPath,
  convertToLocalFileSystemPath,
} = require('./path');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
  FileSystemErrorContext,
  logFileSystemErrorInstance,
  logApiErrorInstance,
  logErrorInstance,
} = require('./errorHandlers');

type FileManagerApiOptions = { includeArchived: boolean; overwrite?: boolean };

async function uploadFolder(
  accountId: number,
  src: string,
  dest: string
): Promise<void> {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const files = await walk(src);

  const filesToUpload = files.filter(createIgnoreFilter());

  const len = filesToUpload.length;
  for (let index = 0; index < len; index++) {
    const file = filesToUpload[index];
    const relativePath = file.replace(regex, '');
    const destPath = convertToUnixPath(path.join(dest, relativePath));
    logger.debug(
      'Uploading files from "%s" to "%s" in the File Manager of account %s',
      file,
      destPath,
      accountId
    );
    try {
      await uploadFile(accountId, file, destPath);
      logger.log('Uploaded file "%s" to "%s"', file, destPath);
    } catch (error) {
      logger.error('Uploading file "%s" to "%s" failed', file, destPath);
      if (isFatalError(error)) {
        throw error;
      }
      logApiUploadErrorInstance(
        error,
        new ApiErrorContext({
          accountId,
          request: destPath,
          payload: file,
        })
      );
    }
  }
}

async function skipExisting(
  filepath: string,
  overwrite?: boolean
): Promise<boolean> {
  if (overwrite) {
    return false;
  }
  if (await fs.pathExists(filepath)) {
    logger.log('Skipped existing "%s"', filepath);
    return true;
  }
  return false;
}

async function downloadFile(
  accountId: number,
  file: FileManagerFile,
  dest: string,
  options: FileManagerApiOptions
): Promise<void> {
  const fileName = `${file.name}.${file.extension}`;
  const destPath = convertToLocalFileSystemPath(path.join(dest, fileName));

  if (await skipExisting(destPath, options.overwrite)) {
    return;
  }
  try {
    await http.getOctetStream(
      accountId,
      {
        baseUrl: file.url,
        uri: '',
      },
      destPath
    );
  } catch (err) {
    logErrorInstance(err);
  }
}

async function fetchAllPagedFiles(
  accountId: number,
  folderId: string,
  { includeArchived }: FileManagerApiOptions
): Promise<Array<FileManagerFile>> {
  let totalFiles = null;
  let files: Array<FileManagerFile> = [];
  let count = 0;
  let offset = 0;
  while (totalFiles === null || count < totalFiles) {
    const response = await fetchFiles(accountId, folderId, {
      offset,
      archived: includeArchived,
    });

    if (totalFiles === null) {
      totalFiles = response.total;
    }

    count += response.objects.length;
    offset += response.objects.length;
    files = files.concat(response.objects);
  }

  return files;
}

async function fetchFolderContents(
  accountId: number,
  folder: FileManagerFolder,
  dest: string,
  options: FileManagerApiOptions
): Promise<void> {
  try {
    await fs.ensureDir(dest);
  } catch (err) {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        dest,
        accountId,
        write: true,
      })
    );
  }
  const files = await fetchAllPagedFiles(accountId, folder.id, options);
  for (const file of files) {
    await downloadFile(accountId, file, dest, options);
  }

  const { objects: folders } = await fetchFolders(accountId, folder.id);
  for (const folder of folders) {
    const nestedFolder = path.join(dest, folder.name);
    await fetchFolderContents(accountId, folder, nestedFolder, options);
  }
}

async function downloadFolder(
  accountId: number,
  src: string,
  dest: string,
  folder: FileManagerFolder,
  options: FileManagerApiOptions
): Promise<void> {
  try {
    let absolutePath;

    if (folder.name) {
      absolutePath = convertToLocalFileSystemPath(
        path.resolve(getCwd(), dest, folder.name)
      );
    } else {
      absolutePath = convertToLocalFileSystemPath(path.resolve(getCwd(), dest));
    }

    logger.log(
      'Fetching folder from "%s" to "%s" in the File Manager of account %s',
      src,
      absolutePath,
      accountId
    );
    await fetchFolderContents(accountId, folder, absolutePath, options);
    logger.success(
      'Completed fetch of folder "%s" to "%s" from the File Manager',
      src,
      dest
    );
  } catch (err) {
    logErrorInstance(err);
  }
}

async function downloadSingleFile(
  accountId: number,
  src: string,
  dest: string,
  file: FileManagerFile,
  options: FileManagerApiOptions
): Promise<void> {
  if (!options.includeArchived && file.archived) {
    logger.error(
      '"%s" in the File Manager is an archived file. Try fetching again with the "--include-archived" flag.',
      src
    );
    return;
  }
  if (file.hidden) {
    logger.error('"%s" in the File Manager is a hidden file.', src);
    return;
  }

  try {
    logger.log(
      'Fetching file from "%s" to "%s" in the File Manager of account %s',
      src,
      dest,
      accountId
    );
    await downloadFile(accountId, file, dest, options);
    logger.success(
      'Completed fetch of file "%s" to "%s" from the File Manager',
      src,
      dest
    );
  } catch (err) {
    logErrorInstance(err);
  }
}

async function downloadFileOrFolder(
  accountId: number,
  src: string,
  dest: string,
  options: FileManagerApiOptions
): Promise<void> {
  try {
    if (src == '/') {
      // Filemanager API treats 'None' as the root
      const rootFolder = { id: 'None' };
      await downloadFolder(accountId, src, dest, rootFolder, options);
    } else {
      const { file, folder } = await fetchStat(accountId, src);
      if (file) {
        await downloadSingleFile(accountId, src, dest, file, options);
      } else if (folder) {
        await downloadFolder(accountId, src, dest, folder, options);
      }
    }
  } catch (err) {
    logApiErrorInstance(
      err,
      new ApiErrorContext({
        request: src,
        accountId,
      })
    );
  }
}

export { uploadFile, downloadFileOrFolder };
