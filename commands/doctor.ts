import { trackCommandUsage } from '../lib/usageTracking';
import { logger } from '@hubspot/local-dev-lib/logger';
import fs from 'fs';
import { Doctor } from '../lib/doctor';

import { EXIT_CODES } from '../lib/enums/exitCodes';
import path from 'path';

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
