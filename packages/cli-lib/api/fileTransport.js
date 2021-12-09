const fs = require('fs');
const path = require('path');
const http = require('../http');
const { getCwd } = require('../path');

const HUBFILES_API_PATH = '/file-transport/v1/hubfiles';

async function createSchema(accountId, filepath) {
  return http.post(accountId, {
    url: `${HUBFILES_API_PATH}/object-schemas`,
    formData: {
      file: fs.createReadStream(path.resolve(getCwd(), filepath)),
    },
  });
}

async function updateSchema(accountId, filepath) {
  return http.put(accountId, {
    url: `${HUBFILES_API_PATH}/object-schemas`,
    formData: {
      file: fs.createReadStream(path.resolve(getCwd(), filepath)),
    },
  });
}

async function fetchSchema(accountId, objectName, path) {
  return http.getOctetStream(
    accountId,
    {
      url: `${HUBFILES_API_PATH}/object-schemas/${objectName}`,
    },
    path
  );
}

module.exports = {
  createSchema,
  updateSchema,
  fetchSchema,
};
