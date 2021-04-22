const fs = require('fs');
const path = require('path');
const http = require('../http');
const { getCwd } = require('../path');

const HUBFILES_API_PATH = '/file-transport/v1/hubfiles';

async function createSchema(accountId, filepath) {
  return http.post(accountId, {
    uri: `${HUBFILES_API_PATH}/object-schemas`,
    formData: {
      file: fs.createReadStream(path.resolve(getCwd(), filepath)),
    },
  });
}

async function updateSchema(accountId, filepath) {
  return http.put(accountId, {
    uri: `${HUBFILES_API_PATH}/object-schemas`,
    formData: {
      file: fs.createReadStream(path.resolve(getCwd(), filepath)),
    },
  });
}

module.exports = {
  createSchema,
  updateSchema,
};
