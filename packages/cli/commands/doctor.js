const pkg = require('../package.json');
const { getProjectConfig } = require('../lib/projects');
const { getAccessToken } = require('@hubspot/local-dev-lib/personalAccessKey');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const SpinniesManager = require('../lib/ui/SpinniesManager');
const fs = require('fs');
const Doctor = require('../lib/doctor');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

// const i18nKey = 'commands.doctor';
exports.command = 'doctor';
exports.describe = 'The doctor is in';

exports.handler = async ({ file, verbose }) => {
  const doctor = new Doctor();

  try {
    trackCommandUsage('doctor', null, doctor.accountId);
  } catch (e) {
    logger.debug(e);
  }

  const diagnosis = await doctor.diagnose();

  const stringifiedOutput = JSON.stringify(diagnosis, null, 4);

  if (verbose) {
    console.log(stringifiedOutput);
  }

  if (file) {
    try {
      fs.writeFileSync(file, stringifiedOutput);
      logger.success(`Output written to ${file}`);
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
    verbose: {
      describe: 'Chatty?',
      type: 'boolean',
    },
  });
