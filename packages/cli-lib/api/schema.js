const fs = require('fs-extra');
const http = require('../http');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

const createSchema = (accountId, filePath) =>
  http.post(accountId, {
    url: SCHEMA_API_PATH,
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const updateSchema = async (accountId, schemaObjectType, filePath) =>
  http.patch(accountId, {
    url: `${SCHEMA_API_PATH}/${schemaObjectType}`,
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const fetchSchema = async (accountId, schemaObjectType) =>
  http.get(accountId, {
    url: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

const fetchSchemas = async accountId =>
  http.get(accountId, {
    url: SCHEMA_API_PATH,
  });

const deleteSchema = async (accountId, schemaObjectType) =>
  http.delete(accountId, {
    url: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

module.exports = {
  createSchema,
  updateSchema,
  fetchSchema,
  fetchSchemas,
  deleteSchema,
};
