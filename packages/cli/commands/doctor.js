const { trackCommandUsage } = require('../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const fs = require('fs');
const Doctor = require('../lib/doctor');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

// const i18nKey = 'commands.doctor';
exports.command = 'doctor';
exports.describe = 'The doctor is in';

exports.handler = async ({ file }) => {
  const doctor = new Doctor();

  try {
    trackCommandUsage('doctor', null, doctor.accountId);
  } catch (e) {
    logger.debug(e);
  }
  const diagnosis = await doctor.diagnose();

  if (file) {
    try {
      fs.writeFileSync(file, JSON.stringify(diagnosis, null, 4));
      logger.info(`Output written to ${file}`);
    } catch (e) {
      logger.error(`Unable to write output to ${file}, ${e.message}`);
      process.exit(EXIT_CODES.ERROR);
    }
  }
};

exports.builder = yargs =>
  yargs.option({
    file: {
      describe: 'Where to write the output',
      type: 'string',
    },
  });
