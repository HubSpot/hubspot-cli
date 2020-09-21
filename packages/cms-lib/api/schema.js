const fs = require('fs-extra');
const http = require('../http');
const chalk = require('chalk');
const { logger } = require('@hubspot/cms-lib/logger');
const { table, getBorderCharacters } = require('table');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

const logSchemas = schemas => {
  const data = schemas
    .map(r => [r.labels.singular, r.name, r.objectTypeId])
    .sort((a, b) => (a[1] > b[1] ? 1 : -1));
  data.unshift([
    chalk.bold('Label'),
    chalk.bold('Name'),
    chalk.bold('objectTypeId'),
  ]);

  const tableConfig = {
    singleLine: true,
    border: getBorderCharacters('honeywell'),
  };

  logger.log(data.length ? table(data, tableConfig) : 'No Schemas were found');
};

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

const listSchemas = async portalId => {
  const response = await fetchSchemas(portalId);
  logSchemas(response.results);
};

module.exports = {
  createSchema,
  updateSchema,
  fetchSchema,
  fetchSchemas,
  deleteSchema,

  listSchemas,
};
