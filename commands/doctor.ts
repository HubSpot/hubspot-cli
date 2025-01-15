import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../lib/usageTracking';
import { logger } from '@hubspot/local-dev-lib/logger';
import fs from 'fs';
import { Doctor } from '../lib/doctor/Doctor';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import path from 'path';
import { ArgumentsCamelCase, BuilderCallback, Options } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { addGlobalOptions } from '../lib/commonOpts';
const { i18n } = require('../lib/lang');

export interface DoctorOptions {
  'output-dir'?: string;
  someNewField: number;
}

const i18nKey = 'commands.doctor';

export const command = 'doctor';
export const describe = i18n(`${i18nKey}.describe`);

export const handler = async ({
  outputDir,
}: ArgumentsCamelCase<DoctorOptions>) => {
  const doctor = new Doctor();

  trackCommandUsage(command, undefined, doctor.accountId || undefined);

  const output = await doctor.diagnose();

  const totalCount = (output?.errorCount || 0) + (output?.warningCount || 0);
  if (totalCount > 0) {
    trackCommandMetadataUsage(
      command,
      { successful: false, type: totalCount },
      doctor.accountId || undefined
    );
  }

  if (!outputDir) {
    if (output?.diagnosis) {
      logger.log(output.diagnosis);
    } else {
      logger.error(i18n(`${i18nKey}.errors.generatingDiagnosis`));
      return process.exit(EXIT_CODES.ERROR);
    }
    return process.exit(EXIT_CODES.SUCCESS);
  }

  if (!path.isAbsolute(outputDir)) {
    outputDir = path.join(getCwd(), outputDir);
  }

  const outputFile = path.join(
    outputDir,
    `hubspot-doctor-${new Date().toISOString()}.json`
  );

  try {
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 4));
    logger.success(i18n(`${i18nKey}.outputWritten`, { filename: outputFile }));
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.unableToWriteOutputFile`, {
        file: outputFile,
        errorMessage: e instanceof Error ? e.message : e,
      })
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  return process.exit(EXIT_CODES.SUCCESS);
};

export const builder: BuilderCallback<DoctorOptions, DoctorOptions> = yargs => {
  yargs.option<keyof DoctorOptions, Options>('output-dir', {
    describe: i18n(`${i18nKey}.options.outputDir`),
    type: 'string',
  });
  addGlobalOptions(yargs);
};
