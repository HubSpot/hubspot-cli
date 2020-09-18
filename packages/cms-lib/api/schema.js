const fs = require('fs-extra');
const http = require('../http');
const path = require('path');
const prettier = require('prettier');
const chalk = require('chalk');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');
const { table, getBorderCharacters } = require('table');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

const writeSchemaToDisk = (schema, dest) => {
  const fullPath = path.resolve(getCwd(), dest || '', `${schema.name}.json`);
  fs.outputFileSync(
    fullPath,
    prettier.format(JSON.stringify(schema), {
      parser: 'json',
    })
  );
};

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

exports.createSchema = (portalId, filePath) =>
  http.post(portalId, {
    uri: SCHEMA_API_PATH,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

exports.updateSchema = async (portalId, schemaObjectType, filePath) =>
  http.patch(portalId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

exports.fetchSchema = async (portalId, schemaObjectType) =>
  http.get(portalId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

exports.fetchSchemas = async portalId =>
  http.get(portalId, {
    uri: SCHEMA_API_PATH,
  });

exports.deleteSchema = async (portalId, schemaObjectType) =>
  http.delete(portalId, {
    uri: `${SCHEMA_API_PATH}/${schemaObjectType}`,
  });

exports.downloadSchemas = async (portalId, dest) => {
  const response = await this.fetchSchemas(portalId);
  logSchemas(response.results);

  if (response.results.length) {
    response.results.forEach(r => writeSchemaToDisk(r, dest));
    logger.log(`Wrote schemas to ${path.resolve(getCwd(), dest || '')}`);
  }
};

exports.downloadSchema = async (portalId, schemaObjectType, dest) => {
  const response = await this.fetchSchema(portalId, schemaObjectType);
  writeSchemaToDisk(response, dest);
};

exports.listSchemas = async portalId => {
  const response = await this.fetchSchemas(portalId);
  logSchemas(response.results);
};
