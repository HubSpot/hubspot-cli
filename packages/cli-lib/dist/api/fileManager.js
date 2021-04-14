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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("../http"));
const FILE_MANAGER_V2_API_PATH = 'filemanager/api/v2';
const FILE_MANAGER_V3_API_PATH = 'filemanager/api/v3';
function uploadFile(accountId, src, dest) {
    return __awaiter(this, void 0, void 0, function* () {
        const directory = path_1.default.dirname(dest);
        const filename = path_1.default.basename(dest);
        const formData = {
            file: fs_1.default.createReadStream(src),
            fileName: filename,
            options: JSON.stringify({
                access: 'PUBLIC_INDEXABLE',
                overwrite: true,
            }),
        };
        if (directory && directory !== '.') {
            formData.folderPath = directory;
        }
        else {
            formData.folderPath = '/';
        }
        return http_1.default.post(accountId, {
            uri: `${FILE_MANAGER_V3_API_PATH}/files/upload`,
            formData,
        });
    });
}
function fetchStat(accountId, src) {
    return __awaiter(this, void 0, void 0, function* () {
        return http_1.default.get(accountId, {
            uri: `${FILE_MANAGER_V2_API_PATH}/files/stat/${src}`,
        });
    });
}
function fetchFiles(accountId, folderId, { offset, archived }) {
    return __awaiter(this, void 0, void 0, function* () {
        return http_1.default.get(accountId, {
            uri: `${FILE_MANAGER_V2_API_PATH}/files/`,
            qs: Object.assign({ hidden: 0, offset: offset, folder_id: folderId }, (!archived && { archived: 0 })),
        });
    });
}
function fetchFolders(accountId, folderId) {
    return __awaiter(this, void 0, void 0, function* () {
        return http_1.default.get(accountId, {
            uri: `${FILE_MANAGER_V2_API_PATH}/folders/`,
            qs: {
                hidden: 0,
                parent_folder_id: folderId,
            },
        });
    });
}
module.exports = {
    uploadFile,
    fetchStat,
    fetchFiles,
    fetchFolders,
};
