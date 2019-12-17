const fs = require('fs');
const path = require('path');
const http = require('../http');

const FILE_MANAGER_API_PATH = 'filemanager/api/v2';

async function uploadFile(portalId, src, dest) {
  const directory = path.dirname(dest);
  const filename = path.basename(dest);

  return http.post(portalId, {
    uri: `${FILE_MANAGER_API_PATH}/files`,
    qs: {
      overwrite: 'true',
    },
    formData: {
      file: fs.createReadStream(src),
      file_names: filename,
      folder_paths: directory,
    },
  });
}

module.exports = {
  uploadFile,
};
