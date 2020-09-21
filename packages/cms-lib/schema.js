const fs = require('fs-extra');
const path = require('path');
const prettier = require('prettier');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');
const { fetchSchemas, fetchSchema } = require('./api/schema');
const chalk = require('chalk');
const { table, getBorderCharacters } = require('table');

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

const writeSchemaToDisk = (schema, dest) => {
  const fullPath = path.resolve(getCwd(), dest || '', `${schema.name}.json`);
  fs.outputFileSync(
    fullPath,
    prettier.format(JSON.stringify(schema), {
      parser: 'json',
    })
  );
};

const listSchemas = async portalId => {
  const response = await fetchSchemas(portalId);
  logSchemas(response.results);
};

const downloadSchemas = async (portalId, dest) => {
  const response = await fetchSchemas(portalId);
  logSchemas(response.results);

  if (response.results.length) {
    response.results.forEach(r => writeSchemaToDisk(r, dest));
    logger.log(`Wrote schemas to ${path.resolve(getCwd(), dest || '')}`);
  }
};

const downloadSchema = async (portalId, schemaObjectType, dest) => {
  const response = await fetchSchema(portalId, schemaObjectType);
  writeSchemaToDisk(response, dest);
};

module.exports = {
  writeSchemaToDisk,
  listSchemas,
  downloadSchemas,
  downloadSchema,
};
