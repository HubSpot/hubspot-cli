import { ArgumentsCamelCase, Argv } from 'yargs';
import path from 'path';
import fs from 'fs';
import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../lib/usageTracking';
import { logger } from '@hubspot/local-dev-lib/logger';
import { Doctor } from '../lib/doctor/Doctor';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { CommonArgs, YargsCommandModule } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { i18n } from '../lib/lang';

export type DoctorArgs = CommonArgs & {
  outputDir?: string;
};

const command = 'doctor';
const describe = i18n(`commands.doctor.describe`);

const handler = async (args: ArgumentsCamelCase<DoctorArgs>) => {
  const { outputDir } = args;

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
      logger.error(i18n(`commands.doctor.errors.generatingDiagnosis`));
      return process.exit(EXIT_CODES.ERROR);
    }
    return process.exit(EXIT_CODES.SUCCESS);
  }

  let outputDirPath = outputDir;

  if (!path.isAbsolute(outputDirPath)) {
    outputDirPath = path.join(getCwd(), outputDirPath);
  }

  const outputFile = path.join(
    outputDirPath,
    `hubspot-doctor-${new Date().toISOString()}.json`
  );

  try {
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 4));
    logger.success(
      i18n(`commands.doctor.outputWritten`, { filename: outputFile })
    );
  } catch (e) {
    logger.error(
      i18n(`commands.doctor.errors.unableToWriteOutputFile`, {
        file: outputFile,
        errorMessage: e instanceof Error ? e.message : (e as string),
      })
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  return process.exit(EXIT_CODES.SUCCESS);
};

function doctorBuilder(yargs: Argv): Argv<DoctorArgs> {
  yargs.option('output-dir', {
    describe: i18n(`commands.doctor.options.outputDir`),
    type: 'string',
  });

  return yargs as Argv<DoctorArgs>;
}

const builder = makeYargsBuilder<DoctorArgs>(doctorBuilder, command, describe, {
  useGlobalOptions: true,
});

const doctorCommand: YargsCommandModule<unknown, DoctorArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default doctorCommand;

// TODO Remove this after cli.ts is ported to TS
module.exports = doctorCommand;
