"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require('fs-extra');
const path = require('path');
const { uploadFile, fetchStat, fetchFiles, fetchFolders, } = require('./api/fileManager');
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { createIgnoreFilter } = require('./ignoreRules');
const http = require('./http');
const escapeRegExp = require('./lib/escapeRegExp');
const { getCwd, convertToUnixPath, convertToLocalFileSystemPath, } = require('./path');
const { ApiErrorContext, logApiUploadErrorInstance, isFatalError, FileSystemErrorContext, logFileSystemErrorInstance, logApiErrorInstance, logErrorInstance, } = require('./errorHandlers');
/**
 *
 * @param {number} accountId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
function uploadFolder(accountId, src, dest) {
    return __awaiter(this, void 0, void 0, function* () {
        const regex = new RegExp(`^${escapeRegExp(src)}`);
        const files = yield walk(src);
        const filesToUpload = files.filter(createIgnoreFilter());
        const len = filesToUpload.length;
        for (let index = 0; index < len; index++) {
            const file = filesToUpload[index];
            const relativePath = file.replace(regex, '');
            const destPath = convertToUnixPath(path.join(dest, relativePath));
            logger.debug('Uploading files from "%s" to "%s" in the File Manager of account %s', file, destPath, accountId);
            try {
                yield uploadFile(accountId, file, destPath);
                logger.log('Uploaded file "%s" to "%s"', file, destPath);
            }
            catch (error) {
                logger.error('Uploading file "%s" to "%s" failed', file, destPath);
                if (isFatalError(error)) {
                    throw error;
                }
                logApiUploadErrorInstance(error, new ApiErrorContext({
                    accountId,
                    request: destPath,
                    payload: file,
                }));
            }
        }
    });
}
/**
 * @private
 * @async
 * @param {boolean} input
 * @param {string} filepath
 * @returns {Promise<boolean}
 */
function skipExisting(overwrite, filepath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (overwrite) {
            return false;
        }
        if (yield fs.pathExists(filepath)) {
            logger.log('Skipped existing "%s"', filepath);
            return true;
        }
        return false;
    });
}
/**
 *
 * @param {number} accountId
 * @param {object} file
 * @param {string} dest
 * @param {object} options
 */
function downloadFile(accountId, file, dest, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileName = `${file.name}.${file.extension}`;
        const destPath = convertToLocalFileSystemPath(path.join(dest, fileName));
        if (yield skipExisting(options.overwrite, destPath)) {
            return;
        }
        try {
            yield http.getOctetStream(accountId, {
                baseUrl: file.url,
                uri: '',
            }, destPath);
        }
        catch (err) {
            logErrorInstance(err);
        }
    });
}
/**
 *
 * @param {number} accountId
 * @param {string} folderPath
 */
function fetchAllPagedFiles(accountId, folderId, { includeArchived }) {
    return __awaiter(this, void 0, void 0, function* () {
        let totalFiles = null;
        let files = [];
        let count = 0;
        let offset = 0;
        while (totalFiles === null || count < totalFiles) {
            const response = yield fetchFiles(accountId, folderId, {
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
    });
}
/**
 *
 * @param {number} accountId
 * @param {object} folder
 * @param {string} dest
 * @param {object} options
 */
function fetchFolderContents(accountId, folder, dest, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.ensureDir(dest);
        }
        catch (err) {
            logFileSystemErrorInstance(err, new FileSystemErrorContext({
                dest,
                accountId,
                write: true,
            }));
        }
        const files = yield fetchAllPagedFiles(accountId, folder.id, options);
        for (const file of files) {
            yield downloadFile(accountId, file, dest, options);
        }
        const { objects: folders } = yield fetchFolders(accountId, folder.id);
        for (const folder of folders) {
            const nestedFolder = path.join(dest, folder.name);
            yield fetchFolderContents(accountId, folder, nestedFolder, options);
        }
    });
}
/**
 * Download a folder and write to local file system.
 *
 * @param {number} accountId
 * @param {string} src
 * @param {string} dest
 * @param {object} folder
 * @param {object} options
 */
function downloadFolder(accountId, src, dest, folder, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let absolutePath;
            if (folder.name) {
                absolutePath = convertToLocalFileSystemPath(path.resolve(getCwd(), dest, folder.name));
            }
            else {
                absolutePath = convertToLocalFileSystemPath(path.resolve(getCwd(), dest));
            }
            logger.log('Fetching folder from "%s" to "%s" in the File Manager of account %s', src, absolutePath, accountId);
            yield fetchFolderContents(accountId, folder, absolutePath, options);
            logger.success('Completed fetch of folder "%s" to "%s" from the File Manager', src, dest);
        }
        catch (err) {
            logErrorInstance(err);
        }
    });
}
/**
 * Download a single file and write to local file system.
 *
 * @param {number} accountId
 * @param {string} src
 * @param {string} dest
 * @param {object} file
 * @param {object} options
 */
function downloadSingleFile(accountId, src, dest, file, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!options.includeArchived && file.archived) {
            logger.error('"%s" in the File Manager is an archived file. Try fetching again with the "--include-archived" flag.', src);
            return;
        }
        if (file.hidden) {
            logger.error('"%s" in the File Manager is a hidden file.', src);
            return;
        }
        try {
            logger.log('Fetching file from "%s" to "%s" in the File Manager of account %s', src, dest, accountId);
            yield downloadFile(accountId, file, dest, options);
            logger.success('Completed fetch of file "%s" to "%s" from the File Manager', src, dest);
        }
        catch (err) {
            logErrorInstance(err);
        }
    });
}
/**
 * Lookup path in file manager and initiate download
 *
 * @param {number} accountId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
function downloadFileOrFolder(accountId, src, dest, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (src == '/') {
                // Filemanager API treats 'None' as the root
                const rootFolder = { id: 'None' };
                yield downloadFolder(accountId, src, dest, rootFolder, options);
            }
            else {
                const { file, folder } = yield fetchStat(accountId, src);
                if (file) {
                    yield downloadSingleFile(accountId, src, dest, file, options);
                }
                else if (folder) {
                    yield downloadFolder(accountId, src, dest, folder, options);
                }
            }
        }
        catch (err) {
            logApiErrorInstance(err, new ApiErrorContext({
                request: src,
                accountId,
            }));
        }
    });
}
module.exports = {
    uploadFolder,
    downloadFileOrFolder,
};
