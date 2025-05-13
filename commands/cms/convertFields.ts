import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import fs from 'fs';
import { createIgnoreFilter } from '@hubspot/local-dev-lib/ignoreRules';
import { isAllowedExtension, getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { walk } from '@hubspot/local-dev-lib/fs';
import { getThemeJSONPath } from '@hubspot/local-dev-lib/cms/themes';
import { i18n } from '../../lib/lang';
import {
  FieldsJs,
  isConvertableFieldJs,
} from '@hubspot/local-dev-lib/cms/handleFieldsJS';
import { trackConvertFieldsUsage } from '../../lib/usageTracking';
import { logError } from '../../lib/errorHandlers/index';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'convert-fields';
const describe = i18n(`commands.convertFields.describe`);

type ConvertFieldsArgs = CommonArgs & {
  src: string;
  fieldOptions: string[];
};

function invalidPath(src: string): void {
  logger.error(
    i18n(`commands.convertFields.errors.invalidPath`, {
      path: src,
    })
  );
  process.exit(EXIT_CODES.ERROR);
}

async function handler(
  args: ArgumentsCamelCase<ConvertFieldsArgs>
): Promise<void> {
  let stats: fs.Stats | undefined;
  let projectRoot: string | undefined;
  let src: string | undefined;

  try {
    src = path.resolve(getCwd(), args.src);
    const themeJSONPath = getThemeJSONPath(args.src);
    projectRoot = themeJSONPath
      ? path.dirname(themeJSONPath)
      : path.dirname(getCwd());
    stats = fs.statSync(src);
    if (!stats.isFile() && !stats.isDirectory()) {
      invalidPath(args.src);
      return;
    }
  } catch (e) {
    invalidPath(args.src);
  }

  trackConvertFieldsUsage('process');

  if (!src || !stats || !projectRoot) {
    invalidPath(args.src);
    return;
  }

  if (stats.isFile()) {
    const fieldsJs = await new FieldsJs(
      projectRoot,
      src,
      undefined,
      args.fieldOptions
    ).init();
    if (fieldsJs.rejected) return;
    fieldsJs.saveOutput();
  } else if (stats && stats.isDirectory()) {
    let filePaths: string[] = [];
    try {
      filePaths = await walk(src);
    } catch (e) {
      logError(e);
    }
    const allowedFilePaths = filePaths
      .filter(file => {
        if (!isAllowedExtension(file)) {
          return false;
        }
        return true;
      })
      .filter(createIgnoreFilter(false));
    for (const filePath of allowedFilePaths) {
      if (isConvertableFieldJs(projectRoot, filePath, true)) {
        const fieldsJs = await new FieldsJs(
          projectRoot,
          filePath,
          undefined,
          args.fieldOptions
        ).init();
        if (fieldsJs.rejected) return;
        fieldsJs.saveOutput();
      }
    }
  }
}

function convertFieldsBuilder(yargs: Argv): Argv<ConvertFieldsArgs> {
  yargs.option('src', {
    describe: i18n(`commands.convertFields.positionals.src.describe`),
    type: 'string',
    required: true,
    demandOption: i18n(`commands.convertFields.errors.missingSrc`),
  });
  yargs.option('fieldOptions', {
    describe: i18n(`commands.convertFields.options.options.describe`),
    type: 'array',
    default: [''],
  });
  return yargs as Argv<ConvertFieldsArgs>;
}

const builder = makeYargsBuilder<ConvertFieldsArgs>(
  convertFieldsBuilder,
  command,
  describe
);

const convertFieldsCommand: YargsCommandModule<unknown, ConvertFieldsArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default convertFieldsCommand;
