const fs = require('fs-extra');
const path = require('path');
const prettier = require('prettier');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');
const { logSchemas, fetchSchemas, fetchSchema } = require('./api/schema');

const writeSchemaToDisk = (schema, dest) => {
  const fullPath = path.resolve(getCwd(), dest || '', `${schema.name}.json`);
  fs.outputFileSync(
    fullPath,
    prettier.format(JSON.stringify(schema), {
      parser: 'json',
    })
  );
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
  downloadSchemas,
  downloadSchema,
};
