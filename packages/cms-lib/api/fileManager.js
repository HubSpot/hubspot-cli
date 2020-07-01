const fs = require('fs');
const path = require('path');
const http = require('../http');

const FILE_MANAGER_API_PATH = 'filemanager/api/v2';

async function uploadFile(portalId, src, dest) {
  const directory = path.dirname(dest);
  const filename = path.basename(dest);
  const formData = {
    file: fs.createReadStream(src),
    file_names: filename,
  };

  if (directory && directory !== '.' && directory !== '/') {
    formData.folder_paths = directory;
  }

  return http.post(portalId, {
    uri: `${FILE_MANAGER_API_PATH}/files`,
    qs: {
      overwrite: 'true',
    },
    formData,
  });
}

async function getStat(portalId, src) {
  return http.get(portalId, {
    uri: `${FILE_MANAGER_API_PATH}/files/stat/${src}`,
  });
}

async function getFiles(portalId, folderId, { offset }, showArchived) {
  return http.get(portalId, {
    uri: `${FILE_MANAGER_API_PATH}/files/`,
    qs: {
      hidden: 0,
      offset: offset,
      folder_id: folderId || 'None',
      ...(!showArchived && { archived: 0 }),
    },
  });
}

async function getFolders(portalId, folderId) {
  return http.get(portalId, {
    uri: `${FILE_MANAGER_API_PATH}/folders/`,
    qs: {
      hidden: 0,
      parent_folder_id: folderId || 'None',
    },
  });
}

module.exports = {
  uploadFile,
  getStat,
  getFiles,
  getFolders,
};
