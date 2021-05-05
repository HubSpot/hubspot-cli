import fs from 'fs';
import path from 'path';
import http from '../http';
import { RequestOptions } from '../types';

const FILE_MANAGER_V2_API_PATH = 'filemanager/api/v2';
const FILE_MANAGER_V3_API_PATH = 'filemanager/api/v3';

type FormData = {
  file: fs.ReadStream;
  fileName: string;
  options: string;
  folderPath?: string;
};

async function uploadFile(accountId: number, src: string, dest: string) {
  const directory = path.dirname(dest);
  const filename = path.basename(dest);
  const formData: FormData = {
    file: fs.createReadStream(src),
    fileName: filename,
    options: JSON.stringify({
      access: 'PUBLIC_INDEXABLE',
      overwrite: true,
    }),
  };

  if (directory && directory !== '.') {
    formData.folderPath = directory;
  } else {
    formData.folderPath = '/';
  }

  return http.post(accountId, {
    uri: `${FILE_MANAGER_V3_API_PATH}/files/upload`,
    formData,
  });
}

async function fetchStat(accountId: number, src: string) {
  return http.get(accountId, {
    uri: `${FILE_MANAGER_V2_API_PATH}/files/stat/${src}`,
  });
}

async function fetchFiles(
  accountId: number,
  folderId: string,
  { offset, archived }: { offset: number; archived: string }
) {
  return http.get(accountId, {
    uri: `${FILE_MANAGER_V2_API_PATH}/files/`,
    qs: {
      hidden: 0,
      offset: offset,
      folder_id: folderId,
      ...(!archived && { archived: 0 }),
    },
  });
}

async function fetchFolders(accountId: number, folderId: string) {
  return http.get(accountId, {
    uri: `${FILE_MANAGER_V2_API_PATH}/folders/`,
    qs: {
      hidden: 0,
      parent_folder_id: folderId,
    },
  });
}

module.exports = {
  uploadFile,
  fetchStat,
  fetchFiles,
  fetchFolders,
};
