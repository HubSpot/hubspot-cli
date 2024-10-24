import { trackCommandUsage } from '../lib/usageTracking';
import { logger } from '@hubspot/local-dev-lib/logger';
import fs from 'fs';
import { Doctor } from '../lib/doctor/Doctor';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import path from 'path';
import { ArgumentsCamelCase, BuilderCallback, Options } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
interface DoctorOptions {
  'output-dir': string;
}

// const i18nKey = 'commands.doctor';
export const command = 'doctor';
export const describe = 'The doctor is in';

export const handler = async ({
  outputDir,
}: ArgumentsCamelCase<DoctorOptions>) => {
  const doctor = new Doctor();

  try {
    trackCommandUsage('doctor', undefined, doctor.accountId);
  } catch (e) {
    logger.debug(e);
  }

  const output = await doctor.diagnose();

  if (!outputDir) {
    if (output?.diagnosis) {
      console.log(output.diagnosis);
    } else {
      logger.error('Error generating diagnosis');
      return process.exit(EXIT_CODES.ERROR);
    }
    return process.exit(EXIT_CODES.SUCCESS);
  }

  if (!path.isAbsolute(outputDir)) {
    outputDir = path.join(getCwd(), outputDir);
  }

  const outputFile = path.join(
    outputDir,
    `doctor-${new Date().toISOString()}.json`
  );

  try {
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 4));
    logger.success(`Output written to ${outputFile}`);
  } catch (e) {
    logger.error(
      `Unable to write output to ${outputFile}, ${
        e instanceof Error ? e.message : e
      }`
    );
    return process.exit(EXIT_CODES.ERROR);
  }
};

export const builder: BuilderCallback<DoctorOptions, DoctorOptions> = yargs => {
  yargs.option<keyof DoctorOptions, Options>('output-dir', {
    describe: 'The directory to write the output file into',
    type: 'string',
  });
};
