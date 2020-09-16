const fs = require('fs-extra');
const http = require('../http');
const path = require('path');
const prettier = require('prettier');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');

const SCHEMA_API_PATH = 'crm-object-schemas/v3/schemas';

const writeSchemaToDisk = (schema, dest) => {
  const outputPath = path.resolve(getCwd(), dest || '');
  const fullPath = path.resolve(getCwd(), dest || '', `${schema.name}.json`);
  fs.outputFileSync(
    fullPath,
    prettier.format(JSON.stringify(schema), {
      parser: 'json',
    })
  );
  logger.log(`Wrote schema ${schema.name} to ${outputPath}`);
};

exports.createSchema = (portalId, filePath) =>
  http.post(portalId, {
    uri: SCHEMA_API_PATH,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

exports.fetchSchema = async (portalId, schemaObjectType) =>
  http.get(portalId, {
    uri: `${SCHEMA_API_PATH}${schemaObjectType ? `/${schemaObjectType}` : ''}`,
  });

exports.downloadMultipleSchema = async (portalId, dest) => {
  const response = await this.fetchSchema(portalId);
  response.results.forEach(r => writeSchemaToDisk(r, dest));
};

exports.downloadSchema = async (portalId, schemaObjectType, dest) => {
  const response = await this.fetchSchema(portalId, schemaObjectType);
  writeSchemaToDisk(response, dest);
};
