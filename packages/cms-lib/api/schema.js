const fs = require('fs');
const http = require('../http');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

exports.createSchema = (portalId, filePath) => {
  return http.post(portalId, {
    uri: SCHEMA_API_PATH,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });
};
