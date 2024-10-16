const { trackCommandUsage } = require('../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const fs = require('fs');
const { Doctor } = require('../lib/doctor');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const path = require('path');
const util = require('node:util');

// const i18nKey = 'commands.doctor';
exports.command = 'doctor';
exports.describe = 'The doctor is in';

exports.handler = async ({ outputDir }) => {
  const doctor = new Doctor();

  try {
    trackCommandUsage('doctor', null, doctor.accountId);
  } catch (e) {
    logger.debug(e);
  }
  const output = await doctor.diagnose();

  if (!outputDir) {
    const { diagnosis } = output;
    console.log(diagnosis.toString());
    process.exit(EXIT_CODES.SUCCESS);
  }

  const outputFile = path.join(
    outputDir,
    `doctor-${new Date().toISOString()}.json`
  );
  try {
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 4));
    logger.success(`Output written to ${outputFile}`);
  } catch (e) {
    logger.error(`Unable to write output to ${outputFile}, ${e.message}`);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs =>
  yargs.option({
    'output-dir': {
      describe: 'The directory to write the output file into',
      type: 'string',
    },
  });
