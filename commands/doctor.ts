import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import fs from 'fs';
import { trackCommandMetadataUsage } from '../lib/usageTracking.js';
import { Doctor } from '../lib/doctor/Doctor.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { CommonArgs, YargsCommandModule } from '../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { uiLogger } from '../lib/ui/logger.js';
import { removeAnsiCodes } from '../lib/ui/removeAnsiCodes.js';
import { commands } from '../lang/en.js';
import { getErrorMessage } from '../lib/errorHandlers/index.js';

export type DoctorArgs = CommonArgs & {
  outputDir?: string;
};

const command = 'doctor';
const describe = commands.doctor.describe;

const handler = async (args: ArgumentsCamelCase<DoctorArgs>) => {
  const { outputDir, exit } = args;

  const doctor = new Doctor();

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
      uiLogger.log(output.diagnosis);
    } else {
      uiLogger.error(commands.doctor.errors.generatingDiagnosis);
      return exit(EXIT_CODES.ERROR);
    }
    return exit(EXIT_CODES.SUCCESS);
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
    const cleanedOutput = {
      ...output,
      diagnosis: output?.diagnosis
        ? removeAnsiCodes(output.diagnosis)
        : undefined,
    };
    fs.writeFileSync(outputFile, JSON.stringify(cleanedOutput, null, 4));
    uiLogger.success(commands.doctor.outputWritten(outputFile));
  } catch (e) {
    uiLogger.error(
      commands.doctor.errors.unableToWriteOutputFile(
        outputFile,
        getErrorMessage(e)
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
};

function doctorBuilder(yargs: Argv): Argv<DoctorArgs> {
  yargs.option('output-dir', {
    describe: commands.doctor.options.outputDir,
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
  handler: makeYargsHandlerWithUsageTracking('doctor', handler),
  builder,
};

export default doctorCommand;
