const fs = require('fs-extra');
const http = require('../http');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

const createSchema = (accountId, filePath) =>
  http.post(accountId, {
    uri: SCHEMA_API_PATH,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const updateSchema = async (accountId, schemaObjectType, filePath) =>
  http.patch(accountId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const fetchSchema = async (accountId, schemaObjectType) =>
  http.get(accountId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

const fetchSchemas = async accountId =>
  http.get(accountId, {
    uri: SCHEMA_API_PATH,
  });

const deleteSchema = async (accountId, schemaObjectType) =>
  http.delete(accountId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

module.exports = {
  createSchema,
  updateSchema,
  fetchSchema,
  fetchSchemas,
  deleteSchema,
};
