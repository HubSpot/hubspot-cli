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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFileOrFolder = exports.uploadFile = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const { uploadFile, fetchStat, fetchFiles, fetchFolders, } = require('./api/fileManager');
exports.uploadFile = uploadFile;
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { createIgnoreFilter } = require('./ignoreRules');
const http = require('./http');
const escapeRegExp = require('./lib/escapeRegExp');
const { getCwd, convertToUnixPath, convertToLocalFileSystemPath, } = require('./path');
const { ApiErrorContext, logApiUploadErrorInstance, isFatalError, FileSystemErrorContext, logFileSystemErrorInstance, logApiErrorInstance, logErrorInstance, } = require('./errorHandlers');
function uploadFolder(accountId, src, dest) {
    return __awaiter(this, void 0, void 0, function* () {
        const regex = new RegExp(`^${escapeRegExp(src)}`);
        const files = yield walk(src);
        const filesToUpload = files.filter(createIgnoreFilter());
        const len = filesToUpload.length;
        for (let index = 0; index < len; index++) {
            const file = filesToUpload[index];
            const relativePath = file.replace(regex, '');
            const destPath = convertToUnixPath(path_1.default.join(dest, relativePath));
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
function skipExisting(filepath, overwrite) {
    return __awaiter(this, void 0, void 0, function* () {
        if (overwrite) {
            return false;
        }
        if (yield fs_extra_1.default.pathExists(filepath)) {
            logger.log('Skipped existing "%s"', filepath);
            return true;
        }
        return false;
    });
}
function downloadFile(accountId, file, dest, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileName = `${file.name}.${file.extension}`;
        const destPath = convertToLocalFileSystemPath(path_1.default.join(dest, fileName));
        if (yield skipExisting(destPath, options.overwrite)) {
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
function fetchFolderContents(accountId, folder, dest, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs_extra_1.default.ensureDir(dest);
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
            const nestedFolder = path_1.default.join(dest, folder.name);
            yield fetchFolderContents(accountId, folder, nestedFolder, options);
        }
    });
}
function downloadFolder(accountId, src, dest, folder, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let absolutePath;
            if (folder.name) {
                absolutePath = convertToLocalFileSystemPath(path_1.default.resolve(getCwd(), dest, folder.name));
            }
            else {
                absolutePath = convertToLocalFileSystemPath(path_1.default.resolve(getCwd(), dest));
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
exports.downloadFileOrFolder = downloadFileOrFolder;
