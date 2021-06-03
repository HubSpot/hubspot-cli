const fs = require('fs-extra');
const path = require('path');
const prettier = require('prettier');
const { getCwd } = require('./path');
const { logger } = require('./logger');
const { fetchSchemas, fetchSchema } = require('./api/schema');
const chalk = require('chalk');
const { table, getBorderCharacters } = require('table');

const logSchemas = schemas => {
  const data = schemas
    .map(r => [r.labels.singular, r.name, r.objectTypeId || ''])
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

const cleanSchema = schema => {
  const parsedSchema = {};
  parsedSchema.name = schema.name;
  parsedSchema.labels = schema.labels;
  parsedSchema.requiredProperties = schema.requiredProperties;
  parsedSchema.searchableProperties = schema.searchableProperties;
  parsedSchema.primaryDisplayProperty = schema.primaryDisplayProperty;
  parsedSchema.associatedObjects = schema.associatedObjects;

  parsedSchema.properties = schema.properties
    .filter(p => !p.name.startsWith('hs_'))
    .map(p => ({
      name: p.name,
      label: p.label,
      type: p.type,
      fieldType: p.fieldType,
      description: p.description,
    }));

  return parsedSchema;
};

const getResolvedPath = (dest, name) => {
  if (name) return path.resolve(getCwd(), dest || '', `${name}.json`);

  return path.resolve(getCwd(), dest || '');
};

const writeSchemaToDisk = (schema, dest) =>
  fs.outputFileSync(
    getResolvedPath(dest, schema.name),
    prettier.format(JSON.stringify(cleanSchema(schema)), {
      parser: 'json',
    })
  );

const listSchemas = async accountId => {
  const response = await fetchSchemas(accountId);
  logSchemas(response.results);
};

const downloadSchemas = async (accountId, dest) => {
  const response = await fetchSchemas(accountId);
  logSchemas(response.results);

  if (response.results.length) {
    response.results.forEach(r => writeSchemaToDisk(r, dest));
  }

  return;
};

const downloadSchema = async (accountId, schemaObjectType, dest) => {
  const response = await fetchSchema(accountId, schemaObjectType);
  writeSchemaToDisk(response, dest);
};

module.exports = {
  writeSchemaToDisk,
  getResolvedPath,
  listSchemas,
  cleanSchema,
  downloadSchemas,
  downloadSchema,
  logSchemas,
};
