const fs = require('fs');
const path = require('path');
const http = require('../http');

const FILE_MANAGER_V2_API_PATH = 'filemanager/api/v2';
const FILE_MANAGER_V3_API_PATH = 'filemanager/api/v3';

async function uploadFile(accountId, src, dest) {
  const directory = path.dirname(dest);
  const filename = path.basename(dest);
  const formData = {
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

async function fetchStat(accountId, src) {
  return http.get(accountId, {
    uri: `${FILE_MANAGER_V2_API_PATH}/files/stat/${src}`,
  });
}

async function fetchFiles(accountId, folderId, { offset, archived }) {
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

async function fetchFolders(accountId, folderId) {
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
