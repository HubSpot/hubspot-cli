const fs = require('fs-extra');
const http = require('../http');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

const createSchema = (portalId, filePath) =>
  http.post(portalId, {
    uri: SCHEMA_API_PATH,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const updateSchema = async (portalId, schemaObjectType, filePath) =>
  http.patch(portalId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const fetchSchema = async (portalId, schemaObjectType) =>
  http.get(portalId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

const fetchSchemas = async portalId =>
  http.get(portalId, {
    uri: SCHEMA_API_PATH,
  });

const deleteSchema = async (portalId, schemaObjectType) =>
  http.delete(portalId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

module.exports = {
  createSchema,
  updateSchema,
  fetchSchema,
  fetchSchemas,
  deleteSchema,
};
